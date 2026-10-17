import { defineWorkflow, joinSession } from "@github/copilot-sdk/extension";
import {
    FACTCHECK_COLUMNS,
    FACTCHECK_KINDS,
    REUSE_GRADES,
    TEMPLATES,
    checkTemplate,
    classifyFindings,
    deriveReportPath,
    htmlCompanionPath,
    nextAttempt,
    propagateGrades,
    startAttempt,
    summarizeCoverage,
    validateReportArgs,
    validateReportResult,
} from "./helpers.mjs";
import {
    parseAreas,
    parseExternalProduct,
    parseFactcheck,
    parseRefuterVerdict,
    parseReuseClaims,
    sectionText,
} from "./parse.mjs";
import { findGitRoot, persistReportFiles, preflightReportFiles, replaceReportFiles } from "./report-write.mjs";

const AGENTS = {
    scout: "neo-arc:neo.arc-scout",
    reader: "neo-arc:neo.arc-reader",
    designer: "neo-arc:neo.arc-designer",
    judge: "neo-arc:neo.arc-judge",
    synthesizer: "neo-arc:neo.arc-synthesizer",
    refuter: "neo-arc:neo.arc-refuter",
    critic: "neo-arc:neo.arc-critic",
    report: "neo-arc:neo.arc-report",
    factcheck: "neo-arc:neo.arc-factcheck",
};

const STEP_VERSION = "assessment-v1";
const MAX_REFUTERS = 16;
// 1 Scout + up to 12 Readers (11 areas + external) + 3 Designers + 3 Judges + 1 Synthesizer + 16 Refuters + 1 Critic
// + 1 Report + 3 Factcheckers + at most 1 correction Report = 42 logical calls, each with at most one retry
// (manual for template workers, the SDK schema retry for Report).
const MAX_LOGICAL_CALLS = 1 + 12 + 3 + 3 + 1 + MAX_REFUTERS + 1 + 1 + 3 + 1;
const MAX_TOTAL_SUBAGENTS = MAX_LOGICAL_CALLS * 2;

const REPORT_SCHEMA = {
    type: "object",
    required: ["markdown", "html", "receipt"],
    properties: {
        markdown: { type: "string" },
        html: { type: ["string", "null"] },
        receipt: { type: "string" },
    },
};

const FACTCHECK_UNITS = Object.keys(FACTCHECK_KINDS).map((id) => ({ id, kind: FACTCHECK_KINDS[id] }));

const DESIGNER_ANGLES = [
    {
        id: "smallest-change",
        angle: "Smallest change — the smallest change that delivers the capability behind existing seams.",
    },
    {
        id: "mirror",
        angle: "Mirror — mirror an integration or subsystem that already exists in this repository.",
    },
    { id: "first-class", angle: "First-class — treat the capability as first-class, with its own lifecycle." },
];

const JUDGE_LENSES = [
    {
        id: "maintainer",
        lens: "Repository maintainer — will this fit the code, conventions, and tests that already exist?",
    },
    { id: "architect", lens: "Domain architect — is this the right shape for the capability and its contracts?" },
    {
        id: "security",
        lens: "Security and governance reviewer — what does this expose, and what does it need approved?",
    },
];

function retryPrompt(prompt, role, problems) {
    const headings = TEMPLATES[role].map((h) => `## ${h}`).join("\n");
    const table =
        role === "factcheck"
            ? `\n\nUnder "## Findings" use only this table header (an empty table is valid when there are no findings; ` +
              `Severity is exactly error, warning or nit; Recommendation impact is exactly yes, no or unclear):\n` +
              `| ${FACTCHECK_COLUMNS.join(" | ")} |\n| ${FACTCHECK_COLUMNS.map(() => "---").join(" | ")} |`
            : "";
    return (
        `${prompt}\n\nYour previous reply was rejected: ${problems.join("; ")}.\n` +
        `Reply with exactly these \`##\` headings, in this order, and nothing before the first heading:\n\n` +
        `${headings}${table}\n\nReturn only this template.`
    );
}

/**
 * Run one worker with at most one manual retry. Replies are validated here against the exact template
 * (and an optional semantic check); SDK output schemas are not used here because they carry their own retry
 * (only the Report step uses one, deliberately).
 * Errors thrown by ctx.agent propagate: they are workflow failures, not off-template replies.
 */
async function runWorker(ctx, { role, item, prompt, validate }) {
    let state = startAttempt();
    let problems = [];
    let output;
    while (state.status === "pending" || state.status === "retry") {
        const attempt = state.attempts + 1;
        const text = attempt === 1 ? prompt : retryPrompt(prompt, role, problems);
        const reply = await ctx.step(`${STEP_VERSION}:${role}:${item}:attempt-${attempt}`, async () => {
            const result = await ctx.agent(text, {
                label: `neo-arc-assessment: ${role} ${item} attempt ${attempt}`,
                agent: AGENTS[role],
            });
            return typeof result === "string" ? result : null;
        });
        const check = checkTemplate(reply, TEMPLATES[role]);
        problems = [...check.problems];
        if (check.ok && validate) {
            const extra = validate(reply);
            if (!extra.ok) problems.push(extra.error);
        }
        state = nextAttempt(state, problems.length === 0);
        if (state.status === "accepted") output = reply;
    }
    return state.status === "accepted" ? { ...state, output } : { ...state, problems };
}

/** ctx.parallel turns a thrown worker into null; record that as a failed unit. */
async function runParallel(ctx, units, makeThunk) {
    const raw = await ctx.parallel(units.map((unit) => () => makeThunk(unit)));
    const results = {};
    units.forEach((unit, i) => {
        results[unit.id] = raw[i] ?? { status: "failed", attempts: 0, problems: ["worker did not return a result"] };
    });
    return results;
}

const acceptedOutputs = (results) =>
    Object.fromEntries(
        Object.entries(results)
            .filter(([, r]) => r.status === "accepted")
            .map(([id, r]) => [id, r.output]),
    );

const ensureTrailingNewline = (text) => (text.endsWith("\n") ? text : `${text}\n`);

const neoArcAssessment = defineWorkflow({
    meta: {
        name: "neo-arc-assessment",
        description:
            "Explicit-only: run only when the user asks for the neo-arc-assessment workflow by name. " +
            "Neo Arc assessment, Scout through Factcheck/correction: " +
            "Scout → Readers → 3 Designers → 3 Judges → Synthesizer → Refuters (max 16 reuse claims) → Critic → Report → " +
            "Factcheck (3 checkers in parallel: repository facts, external claims, document structure; at most one correction Report call). " +
            "The workflow itself writes the report Markdown (and an optional sibling HTML) under docs/design/assessments/; " +
            "the Report worker returns content only. Errors and warnings that cannot change the recommendation are corrected once; " +
            "any finding that could (impact yes/unclear) returns needs_user_decision without revising. " +
            "Call ceiling: at most 42 logical calls (1 Scout + up to 12 Readers + 3 Designers + 3 Judges + 1 Synthesizer + " +
            "16 Refuters + 1 Critic + 1 Report + 3 Factcheckers + 1 correction Report), each with at most one retry = " +
            "84 subagent attempts (maxTotalSubagents). " +
            "No AI-credit estimate is made. " +
            "args: { question: string, outputPath?: string (repo-relative .md under docs/design/assessments/; default " +
            "docs/design/assessments/<YYYY-MM-DD>-<topic-slug>-assessment.md), html?: boolean (default false; sibling .html), " +
            "overwrite?: boolean (default false; replace a different existing file) }.",
        phases: [
            { title: "Scout" },
            { title: "Readers" },
            { title: "Designers" },
            { title: "Judges" },
            { title: "Synthesizer" },
            { title: "Refuters" },
            { title: "Critic" },
            { title: "Report" },
            { title: "Factcheck" },
        ],
        argsSchema: {
            type: "object",
            required: ["question"],
            properties: {
                question: { type: "string" },
                outputPath: { type: "string" },
                html: { type: "boolean" },
                overwrite: { type: "boolean" },
            },
        },
        limits: { maxTotalSubagents: MAX_TOTAL_SUBAGENTS },
    },
    run: async (ctx) => {
        const parsedArgs = validateReportArgs(ctx.args);
        if (!parsedArgs.ok) return { ok: false, error: parsedArgs.error };
        const { question, html: wantHtml, overwrite } = parsedArgs;

        // Resolve and pre-check the destination before spending any subagent calls. The date is journaled so a
        // resumed run derives the same path.
        const paths = await ctx.step(`${STEP_VERSION}:report:paths`, async () => {
            const date = new Date().toISOString().slice(0, 10);
            const markdownPath = parsedArgs.outputPath ?? deriveReportPath(question, date);
            return { date, markdownPath, htmlPath: wantHtml ? htmlCompanionPath(markdownPath) : null };
        });
        let gitRoot;
        try {
            gitRoot = await findGitRoot(process.cwd());
            // Content is unknown yet, so this only proves containment and rejects symlinks; the content-aware
            // conflict check runs at write time (an existing identical file is a valid resume).
            await preflightReportFiles(
                gitRoot,
                [paths.markdownPath, paths.htmlPath].filter(Boolean).map((relPath) => ({ relPath, content: "" })),
                true,
            );
        } catch (error) {
            return { ok: false, error: `report destination rejected: ${error.message}` };
        }

        const outputs = {};
        const stages = {}; // role -> { requested: string[], results: Record<id, result> }
        const refuterInfo = { attempted: 0, dropped: 0 };
        let claims = [];

        const record = (role, requested, results) => {
            stages[role] = { requested, results };
        };
        const buildCoverage = () => {
            const byStage = {};
            for (const [role, { requested, results }] of Object.entries(stages)) {
                byStage[role] = summarizeCoverage(requested, results).stages;
            }
            const readers = stages.reader
                ? summarizeCoverage(stages.reader.requested, stages.reader.results)
                : { requested: [], read: [], unread: [] };
            const graded = claims.filter((c) => c.originalGrade !== undefined);
            return {
                readers: { requested: readers.requested, read: readers.read, unread: readers.unread },
                stages: byStage,
                refuters: { ...refuterInfo },
                claims: {
                    total: claims.length,
                    downgraded: graded.filter(
                        (c) => !c.unverified && REUSE_GRADES.indexOf(c.grade) > REUSE_GRADES.indexOf(c.originalGrade),
                    ).length,
                    refuted: graded.filter((c) => c.verdict === "refuted").length,
                    unverified: graded.filter((c) => c.unverified).length,
                },
            };
        };
        const fail = (failedStage, error, extra = {}) => ({
            ok: false,
            question,
            failedStage,
            error,
            coverage: buildCoverage(),
            outputs,
            ...extra,
        });
        const failureText = (name, result) =>
            `${name} failed after ${result.attempts} attempt(s): ${(result.problems ?? []).join("; ")}`;

        // Scout
        ctx.phase("Scout");
        const scout = await runWorker(ctx, {
            role: "scout",
            item: "scout",
            prompt: `Scout the repository for this architecture design question and return the reader brief:\n\n${question}`,
            validate: (reply) => {
                const parsedAreas = parseAreas(reply);
                if (!parsedAreas.ok) return parsedAreas;
                const parsedExternal = parseExternalProduct(reply);
                if (!parsedExternal.ok) return parsedExternal;
                if (!sectionText(reply, "Shared context")) return { ok: false, error: '"Shared context" section is empty' };
                return { ok: true };
            },
        });
        record("scout", ["scout"], { scout });
        if (scout.status !== "accepted") return fail("scout", failureText("scout", scout));
        outputs.scout = scout.output;
        const sharedContext = sectionText(scout.output, "Shared context");
        const areas = parseAreas(scout.output).areas;
        const external = parseExternalProduct(scout.output).product;

        // Readers
        ctx.phase("Readers");
        const readerUnits = areas.map((a, i) => ({
            id: `area-${i + 1}`,
            brief: `Area ${a.n}: ${a.area}\nAnchor files: ${a.anchors}\nWhat to look for: ${a.lookFor}`,
        }));
        if (external !== null) {
            readerUnits.push({
                id: "external",
                brief: `You are the external-product reader. Your area is this external product and its primary-source home:\n${external}`,
            });
        }
        const readerResults = await runParallel(ctx, readerUnits, (unit) =>
            runWorker(ctx, {
                role: "reader",
                item: unit.id,
                prompt: `Shared context:\n${sharedContext}\n\nQuestion:\n${question}\n\nYour area brief:\n${unit.brief}`,
            }),
        );
        record("reader", readerUnits.map((u) => u.id), readerResults);
        const readerOutputs = acceptedOutputs(readerResults);
        outputs.readers = readerOutputs;
        const unreadIds = readerUnits.filter((u) => !(u.id in readerOutputs)).map((u) => u.id);
        if (unreadIds.length === readerUnits.length) {
            return fail("readers", "no reader produced an accepted output; there is no evidence to design from");
        }
        const evidenceMap =
            readerUnits
                .filter((u) => u.id in readerOutputs)
                .map((u) => readerOutputs[u.id])
                .join("\n\n") +
            (unreadIds.length > 0 ? `\n\nUnread areas (no evidence gathered; treat as gaps): ${unreadIds.join(", ")}` : "");

        // Designers
        ctx.phase("Designers");
        const designerResults = await runParallel(ctx, DESIGNER_ANGLES, (a) =>
            runWorker(ctx, {
                role: "designer",
                item: a.id,
                prompt: `Shared context:\n${sharedContext}\n\nQuestion:\n${question}\n\nEvidence map:\n${evidenceMap}\n\nYour angle:\n${a.angle}`,
            }),
        );
        record("designer", DESIGNER_ANGLES.map((a) => a.id), designerResults);
        outputs.designers = acceptedOutputs(designerResults);
        const failedDesigner = DESIGNER_ANGLES.find((a) => designerResults[a.id].status !== "accepted");
        if (failedDesigner) {
            return fail("designers", failureText(`designer ${failedDesigner.id}`, designerResults[failedDesigner.id]));
        }
        const designs = DESIGNER_ANGLES.map((a, i) => `### Design ${i + 1} (${a.id})\n\n${outputs.designers[a.id]}`).join("\n\n");

        // Judges
        ctx.phase("Judges");
        const judgeResults = await runParallel(ctx, JUDGE_LENSES, (l) =>
            runWorker(ctx, {
                role: "judge",
                item: l.id,
                prompt:
                    `Shared context:\n${sharedContext}\n\nQuestion:\n${question}\n\nThe three designs:\n${designs}\n\n` +
                    `Evidence map:\n${evidenceMap}\n\nYour lens:\n${l.lens}`,
            }),
        );
        record("judge", JUDGE_LENSES.map((l) => l.id), judgeResults);
        outputs.judges = acceptedOutputs(judgeResults);
        const failedJudge = JUDGE_LENSES.find((l) => judgeResults[l.id].status !== "accepted");
        if (failedJudge) return fail("judges", failureText(`judge ${failedJudge.id}`, judgeResults[failedJudge.id]));
        const judgements = JUDGE_LENSES.map((l, i) => `### Judgement ${i + 1} (${l.id})\n\n${outputs.judges[l.id]}`).join("\n\n");

        // Synthesizer
        ctx.phase("Synthesizer");
        const synth = await runWorker(ctx, {
            role: "synthesizer",
            item: "synthesizer",
            prompt:
                `Shared context:\n${sharedContext}\n\nQuestion:\n${question}\n\nEvidence map:\n${evidenceMap}\n\n` +
                `The three designs:\n${designs}\n\nThe three judgements:\n${judgements}`,
            validate: parseReuseClaims,
        });
        record("synthesizer", ["synthesizer"], { synthesizer: synth });
        if (synth.status !== "accepted") return fail("synthesizer", failureText("synthesizer", synth));
        outputs.synthesizer = synth.output;
        claims = parseReuseClaims(synth.output).claims;

        // Refuters
        ctx.phase("Refuters");
        const toRefute = claims.slice(0, MAX_REFUTERS);
        refuterInfo.attempted = toRefute.length;
        refuterInfo.dropped = claims.length - toRefute.length;
        const refuterResults = await runParallel(ctx, toRefute, (claim) =>
            runWorker(ctx, {
                role: "refuter",
                item: claim.id,
                prompt:
                    `Question:\n${question}\n\nReuse claim to refute:\n- Component: ${claim.component}\n- Path: ${claim.path}\n` +
                    `- Grade as claimed: ${claim.grade}\n- How it is reused: ${claim.how}`,
                validate: parseRefuterVerdict,
            }),
        );
        record("refuter", toRefute.map((c) => c.id), refuterResults);
        const verdicts = {};
        const refuterOutputs = {};
        for (const claim of toRefute) {
            const result = refuterResults[claim.id];
            if (result.status === "accepted") {
                const { verdict, confidence, correctedGrade } = parseRefuterVerdict(result.output);
                verdicts[claim.id] = { verdict, confidence, correctedGrade };
                refuterOutputs[claim.id] = { claim, output: result.output };
            }
        }
        outputs.refuters = refuterOutputs;
        const attemptedIds = new Set(toRefute.map((c) => c.id));
        claims = propagateGrades(claims, verdicts).map((c) => {
            if (!attemptedIds.has(c.id)) return { ...c, refuterStatus: "not-attempted-over-cap" };
            if (c.id in verdicts) return { ...c, refuterStatus: "accepted" };
            // A refuter that failed twice leaves the claim unconfirmed, so it does not hold.
            return { ...c, verdict: "refuted", confidence: "low", refuterStatus: "failed" };
        });

        // Critic
        ctx.phase("Critic");
        const pairedVerdicts = claims
            .map((c) => {
                const head = `- ${c.id} ${c.component} (${c.path}): claimed ${c.originalGrade}`;
                if (c.refuterStatus === "not-attempted-over-cap") {
                    return `${head}; not refuted (over the ${MAX_REFUTERS}-claim cap) — unverified`;
                }
                if (c.refuterStatus === "failed") {
                    return `${head}; refuter failed twice — refuted, confidence low, corrected grade unverified`;
                }
                return `${head}; verdict ${c.verdict}, confidence ${c.confidence}, corrected grade ${c.grade}`;
            })
            .join("\n");
        const critic = await runWorker(ctx, {
            role: "critic",
            item: "critic",
            prompt:
                `Question:\n${question}\n\nSynthesis:\n${outputs.synthesizer}\n\nRefuter verdicts paired with their claims:\n` +
                `${pairedVerdicts || "(no reuse claims)"}\n\nEvidence map:\n${evidenceMap}`,
        });
        record("critic", ["critic"], { critic });
        if (critic.status !== "accepted") return fail("critic", failureText("critic", critic));
        outputs.critic = critic.output;

        // Report: the worker returns content only; this workflow alone writes the files.
        ctx.phase("Report");
        const coverage = buildCoverage();
        const reportPrompt =
            `Question:\n${question}\n\nDate: ${paths.date}\n\n` +
            `Synthesis:\n${outputs.synthesizer}\n\nRefuter verdicts paired with their claims:\n${pairedVerdicts || "(no reuse claims)"}\n\n` +
            `Critique:\n${outputs.critic}\n\nRun log (JSON):\n${JSON.stringify(coverage)}\n\n` +
            `Report path (for the receipt only; you write nothing): ${paths.markdownPath}\n` +
            `HTML companion: ${wantHtml ? `requested (${paths.htmlPath})` : "not requested; return html as null"}`;
        // The schema call's own single retry is the only retry the Report worker gets.
        const reportRaw = await ctx.step(`${STEP_VERSION}:report:content`, async () => {
            const result = await ctx.agent(reportPrompt, {
                label: "neo-arc-assessment: report",
                agent: AGENTS.report,
                schema: REPORT_SCHEMA,
            });
            return result ?? null;
        });
        const report = validateReportResult(reportRaw, wantHtml);
        if (!report.ok) return fail("report", `report failed: ${report.error}`);
        outputs.report = report.receipt;

        // The initial contents stay in memory: they are the compare-and-swap baseline for the correction.
        const initialFiles = [{ relPath: paths.markdownPath, content: ensureTrailingNewline(report.markdown) }];
        if (wantHtml) initialFiles.push({ relPath: paths.htmlPath, content: ensureTrailingNewline(report.html) });
        let written;
        try {
            // Journaled (not volatile): on resume after a correction the disk holds the revised content, which this
            // step must neither overwrite nor fail against. An interrupted write is never journaled and reruns
            // idempotently. The original overwrite consent applies here and nowhere else.
            written = await ctx.step(`${STEP_VERSION}:report:write`, () => persistReportFiles(gitRoot, initialFiles, overwrite));
        } catch (error) {
            return fail("report", `report write failed: ${error.message}`);
        }
        let reportInfo = { path: paths.markdownPath, htmlPath: paths.htmlPath, written, receipt: report.receipt };

        // Factcheck: three checkers read the persisted report in parallel.
        ctx.phase("Factcheck");
        const checkResults = await runParallel(ctx, FACTCHECK_UNITS, (unit) =>
            runWorker(ctx, {
                role: "factcheck",
                item: unit.id,
                prompt:
                    `Fact-check the written architecture assessment report at this repository-relative path: ${paths.markdownPath}\n` +
                    `Check kind: ${unit.kind}\n` +
                    `Return the Findings table with columns ${FACTCHECK_COLUMNS.join(" | ")}. Severity is exactly error, warning ` +
                    `or nit. Recommendation impact is exactly yes, no or unclear: yes means applying the fix without user input ` +
                    `could change the recommended shape or a decision gate; use unclear when you are not sure. ` +
                    `An empty table means no findings.`,
                validate: (reply) => parseFactcheck(reply, unit.id),
            }),
        );
        record("factcheck", FACTCHECK_UNITS.map((u) => u.id), checkResults);
        outputs.factcheck = acceptedOutputs(checkResults);
        const failedCheck = FACTCHECK_UNITS.find((u) => checkResults[u.id].status !== "accepted");
        if (failedCheck) {
            return fail("factcheck", failureText(`factcheck ${failedCheck.id}`, checkResults[failedCheck.id]), { report: reportInfo });
        }
        const checks = [];
        const findings = [];
        for (const unit of FACTCHECK_UNITS) {
            const parsed = parseFactcheck(checkResults[unit.id].output, unit.id);
            checks.push({ id: unit.id, kind: parsed.kind, checked: parsed.checked, attempts: checkResults[unit.id].attempts });
            for (const f of parsed.findings) findings.push({ source: parsed.kind, ...f });
        }
        const classified = classifyFindings(findings);
        const factcheck = {
            checks,
            summary: { counts: classified.counts, recommendationImpact: classified.recommendationImpact },
            findings,
        };
        const finalCoverage = buildCoverage();

        // Any finding that could change the recommendation or a gate goes to the user; Report is never asked.
        if (classified.blocking.length > 0) {
            return {
                ok: false,
                status: "needs_user_decision",
                question,
                error:
                    `${classified.blocking.length} finding(s) could change the recommendation or a decision gate ` +
                    `(recommendation impact yes/unclear); the report was not revised`,
                outputs,
                claims,
                coverage: finalCoverage,
                report: reportInfo,
                factcheck,
                blocking: classified.blocking,
            };
        }

        const success = (status) => ({
            ok: true,
            status,
            question,
            outputs,
            claims,
            coverage: finalCoverage,
            report: reportInfo,
            factcheck,
            nits: classified.nits,
        });

        if (classified.actionable.length === 0) {
            // Nothing to correct; prove the persisted report is still what was checked (overwrite never allowed here).
            try {
                const verified = await ctx.step(
                    `${STEP_VERSION}:report:verify`,
                    // Compare-and-swap with identical content: requires the files to exist and be unchanged, writes nothing.
                    () => replaceReportFiles(gitRoot, initialFiles, initialFiles),
                    { volatile: true },
                );
                reportInfo = { ...reportInfo, verified };
            } catch (error) {
                return {
                    ok: false,
                    status: "needs_user_decision",
                    question,
                    error: `the report changed on disk after it was fact-checked: ${error.message}`,
                    outputs,
                    claims,
                    coverage: finalCoverage,
                    report: reportInfo,
                    factcheck,
                };
            }
            return success("complete");
        }

        // One correction pass, never re-checked (the call ceiling allows exactly one).
        const correctionPrompt =
            `Question:\n${question}\n\nDate: ${paths.date}\n\n` +
            `Correct this already-written report so that every finding below is fixed. Make the smallest edit that fixes ` +
            `each finding. Preserve the recommendation and the evidence labels, introduce no unsupported facts, keep the ` +
            `refuters' corrected grades, and leave everything else (including nits) unchanged. Return the complete revised ` +
            `files and a receipt on the same template as before.\n\n` +
            `Existing Markdown (exact):\n${initialFiles[0].content}\n\n` +
            `Existing HTML (exact):\n${wantHtml ? initialFiles[1].content : "(not requested; return html as null)"}\n\n` +
            `Existing receipt:\n${report.receipt}\n\n` +
            `Findings to correct (JSON):\n${JSON.stringify(classified.actionable)}\n\n` +
            `Report path (for the receipt only; you write nothing): ${paths.markdownPath}\n` +
            `HTML companion: ${wantHtml ? `requested (${paths.htmlPath})` : "not requested; return html as null"}`;
        const correctionRaw = await ctx.step(`${STEP_VERSION}:report:correction`, async () => {
            const result = await ctx.agent(correctionPrompt, {
                label: "neo-arc-assessment: report correction",
                agent: AGENTS.report,
                schema: REPORT_SCHEMA,
            });
            return result ?? null;
        });
        const revised = validateReportResult(correctionRaw, wantHtml);
        if (!revised.ok) return fail("correction", `report correction failed: ${revised.error}`, { report: reportInfo, factcheck });
        const revisedFiles = [{ relPath: paths.markdownPath, content: ensureTrailingNewline(revised.markdown) }];
        if (wantHtml) revisedFiles.push({ relPath: paths.htmlPath, content: ensureTrailingNewline(revised.html) });
        if (revisedFiles.every((f, i) => f.content === initialFiles[i].content)) {
            return fail("correction", "report correction returned unchanged files despite actionable findings", {
                report: reportInfo,
                factcheck,
            });
        }
        try {
            const replaced = await ctx.step(
                `${STEP_VERSION}:report:replace`,
                () => replaceReportFiles(gitRoot, initialFiles, revisedFiles),
                // Always re-check the disk on resume; replacement is a compare-and-swap and idempotent.
                { volatile: true },
            );
            reportInfo = { ...reportInfo, written: replaced, receipt: revised.receipt };
        } catch (error) {
            return {
                ok: false,
                status: "needs_user_decision",
                question,
                error: `report correction may be partially applied (see report.partial for per-file status): ${error.message}`,
                outputs,
                claims,
                coverage: finalCoverage,
                report: { ...reportInfo, partial: error.persisted ?? {} },
                factcheck,
                revision: { markdown: revisedFiles[0].content, html: wantHtml ? revisedFiles[1].content : null },
            };
        }
        outputs.report = revised.receipt;
        return success("corrected");
    },
});

await joinSession({ workflows: [neoArcAssessment] });
