// Pure helpers for the neo-arc-assessment workflow. No SDK, no filesystem, no I/O.

/** Reuse grades a refuter may return, strongest first. */
export const REUSE_GRADES = ["verbatim", "extend", "pattern-only", "not-reusable"];

/** Required ordered `##` headings per worker (mirrors the orchestrator's template checklist). */
export const TEMPLATES = {
    scout: [
        "Question",
        "Shared context",
        "What the question means",
        "Repository state",
        "Governing documents",
        "Keyword hits",
        "Areas",
        "External product",
    ],
    reader: ["Area", "Summary", "Existing mentions of", "Reuse claims", "Gaps", "Constraints", "Facts"],
    designer: [
        "Name and thesis",
        "What the capability means here",
        "Stages",
        "New components",
        "Reused components",
        "Configuration",
        "ADR impact",
        "PRD sections touched",
        "Human gates",
        "Risks",
        "Open questions for the user",
        "Rough effort",
    ],
    judge: ["Lens", "Scores", "Winner", "Graft from the others", "Factual errors spotted"],
    synthesizer: [
        "Recommendation",
        "Phased plan",
        "Reuse claims the recommendation depends on",
        "Not reusable",
        "ADR work",
        "PRD work",
        "Decisions only the user can make",
        "Judge disagreements",
    ],
    refuter: ["Claim", "Verdict", "Confidence", "Reason", "Evidence", "Corrected grade"],
    critic: ["Missing", "Unverified claims", "Premature or overbuilt", "Sharpest question for the user"],
    report: ["Written", "Grades carried", "Unread areas"],
    factcheck: ["Check kind", "Checked", "Findings"],
};

/** Factcheck check kinds, keyed by the stable item id; the value is the exact `## Check kind` text. */
export const FACTCHECK_KINDS = {
    "repository-facts": "repository facts",
    "external-claims": "external claims",
    "document-structure": "document structure",
};

/** Exact column header of the Factcheck `## Findings` table. */
export const FACTCHECK_COLUMNS = ["Severity", "File", "Claim", "Problem", "Evidence", "Recommendation impact", "Fix"];

export const FACTCHECK_SEVERITIES = ["error", "warning", "nit"];

/** `yes`/`unclear`: applying the finding without user input could change the recommended shape or a decision gate. */
export const FACTCHECK_IMPACTS = ["yes", "no", "unclear"];

/**
 * Deterministically classify normalized Factcheck findings.
 * `blocking` = any finding (even a nit) whose impact is `yes` or `unclear`: it needs a user decision and must not be
 * auto-applied. `actionable` = error/warning findings with impact `no`. `nits` = nit findings with impact `no`.
 * `recommendationImpact` is the overall worst case: `yes`, else `unclear`, else `no`.
 */
export function classifyFindings(findings) {
    const counts = { error: 0, warning: 0, nit: 0 };
    const blocking = [];
    const actionable = [];
    const nits = [];
    for (const f of findings) {
        counts[f.severity] += 1;
        if (f.recommendationImpact !== "no") blocking.push(f);
        else if (f.severity === "nit") nits.push(f);
        else actionable.push(f);
    }
    const recommendationImpact = findings.some((f) => f.recommendationImpact === "yes")
        ? "yes"
        : findings.some((f) => f.recommendationImpact === "unclear")
          ? "unclear"
          : "no";
    return { counts, recommendationImpact, blocking, actionable, nits };
}

/**
 * Validate and normalize the design question.
 * @returns {{ ok: true, question: string } | { ok: false, error: string }}
 */
export function normalizeQuestion(value) {
    if (typeof value !== "string" || value.trim() === "") {
        return { ok: false, error: "question is required and must be a non-empty string" };
    }
    return { ok: true, question: value.trim() };
}

/**
 * Check a reply carries exactly the required `##` headings, in order, with nothing
 * before the first heading. A heading passes when its text equals the required text or
 * continues it after a non-alphanumeric boundary (a documented suffix, e.g. "Areas (3)").
 * Headings inside fenced code blocks are ignored; `###` and deeper are body, not headings.
 * @param {unknown} reply
 * @param {string[]} required
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function checkTemplate(reply, required) {
    if (typeof reply !== "string" || reply.trim() === "") {
        return { ok: false, problems: ["reply is empty"] };
    }
    const problems = [];
    const found = [];
    let fence = null;
    let preamble = false;
    for (const line of reply.split(/\r?\n/)) {
        const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
        if (fenceMatch) {
            const marker = fenceMatch[1][0];
            if (fence === null) fence = marker;
            else if (fence === marker) fence = null;
            if (found.length === 0) preamble = true;
            continue;
        }
        if (fence === null) {
            const heading = /^##[ \t]+(.*?)[ \t]*#*[ \t]*$/.exec(line);
            if (heading) {
                found.push(heading[1]);
                continue;
            }
        }
        if (found.length === 0 && line.trim() !== "") preamble = true;
    }
    if (preamble) problems.push("content before the first heading");
    if (found.length !== required.length) {
        problems.push(`expected ${required.length} headings, found ${found.length}`);
    }
    required.forEach((name, i) => {
        const got = found[i];
        if (got === undefined) {
            problems.push(`missing heading "${name}"`);
        } else if (!(got === name || (got.startsWith(name) && !/[A-Za-z0-9]/.test(got[name.length])))) {
            problems.push(`heading ${i + 1}: expected "${name}", found "${got}"`);
        }
    });
    return { ok: problems.length === 0, problems };
}

/** Initial state for a worker run. */
export function startAttempt() {
    return { status: "pending", attempts: 0 };
}

/**
 * Deterministic one-retry transition. Feed it whether the latest reply was on template.
 * pending --on--> accepted | pending --off--> retry | retry --on--> accepted | retry --off--> failed.
 * `accepted` and `failed` are terminal; `retry` means "re-run once". Never returns a third attempt.
 * @param {{ status: string, attempts: number }} state
 * @param {boolean} onTemplate
 */
export function nextAttempt(state, onTemplate) {
    if (state.status === "accepted" || state.status === "failed") return state;
    const prior = Number.isFinite(state.attempts) ? Math.max(0, Math.floor(state.attempts)) : 0;
    const attempts = Math.min(prior + 1, 2);
    if (onTemplate) return { status: "accepted", attempts };
    // Unknown statuses are treated as pending. `retry` is only returned while a further run is still allowed.
    if (attempts >= 2 || state.status === "retry") return { status: "failed", attempts };
    return { status: "retry", attempts };
}

/**
 * Account for coverage of requested units (e.g. reader areas).
 * A unit is `read` only when its result is accepted; failed or missing units are `unread`.
 * Stage counts: success = accepted first try, retry = accepted after a retry, failure = failed or missing.
 * Output presence is decided by status, never by truthiness, so valid falsy outputs (0, "", false) are kept.
 * @param {string[]} requested unit ids
 * @param {Record<string, { status: string, attempts: number, output?: unknown }>} results
 */
export function summarizeCoverage(requested, results) {
    const read = [];
    const unread = [];
    const stages = { success: 0, retry: 0, failure: 0 };
    for (const id of requested) {
        const result = Object.hasOwn(results, id) ? results[id] : undefined;
        if (result?.status === "accepted") {
            read.push(id);
            if (result.attempts > 1) stages.retry += 1;
            else stages.success += 1;
        } else {
            unread.push(id);
            stages.failure += 1;
        }
    }
    return { requested: [...requested], read, unread, stages };
}

/**
 * Propagate refuter corrected grades onto claims. A claim with no usable refuter result
 * (missing, or corrected grade not one of REUSE_GRADES) is `unverified` and keeps its original grade.
 * @param {{ id: string, grade: string }[]} claims
 * @param {Record<string, { verdict?: string, confidence?: string, correctedGrade?: string }>} refuted by claim id
 */
export function propagateGrades(claims, refuted) {
    return claims.map((claim) => {
        const result = Object.hasOwn(refuted, claim.id) ? refuted[claim.id] : undefined;
        const grade = typeof result?.correctedGrade === "string" ? result.correctedGrade.trim() : "";
        if (!REUSE_GRADES.includes(grade)) {
            return { ...claim, originalGrade: claim.grade, unverified: true };
        }
        return {
            ...claim,
            originalGrade: claim.grade,
            grade,
            unverified: false,
            verdict: result.verdict,
            confidence: result.confidence,
        };
    });
}

/** The only repo-relative directory a report may be written under. */
export const ASSESSMENT_DIR = "docs/design/assessments";

const ARG_FIELDS = ["question", "outputPath", "html", "overwrite"];

/**
 * Validate a repo-relative report path. Pure string policy: forward-slash relative path, no `.`/`..`/empty
 * segments, no control characters or backslashes, under ASSESSMENT_DIR, ending in a non-empty `.md` name.
 * @returns {{ ok: true, path: string } | { ok: false, error: string }}
 */
export function validateOutputPath(value) {
    if (typeof value !== "string") return { ok: false, error: "outputPath must be a string" };
    if (value === "" || value.trim() !== value) return { ok: false, error: "outputPath must be non-empty with no surrounding whitespace" };
    if (/[\u0000-\u001f\u007f\\]/.test(value)) {
        return { ok: false, error: "outputPath must use forward slashes and contain no control characters" };
    }
    if (value.startsWith("/") || /^[A-Za-z]:/.test(value)) {
        return { ok: false, error: "outputPath must be repo-relative, not absolute" };
    }
    const segments = value.split("/");
    if (segments.some((s) => s === "" || s === "." || s === "..")) {
        return { ok: false, error: 'outputPath must not contain empty, "." or ".." segments' };
    }
    if (!value.startsWith(`${ASSESSMENT_DIR}/`)) {
        return { ok: false, error: `outputPath must be under ${ASSESSMENT_DIR}/` };
    }
    // Portable names only: no `:` (NTFS alternate streams), spaces, or trailing dots; no Windows device names.
    for (const segment of segments) {
        if (!/^[A-Za-z0-9._-]+$/.test(segment) || segment.endsWith(".")) {
            return { ok: false, error: `outputPath segment "${segment}" is invalid: segments may contain only letters, digits, '.', '_' and '-', and must not end in '.'` };
        }
        if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i.test(segment)) {
            return { ok: false, error: `outputPath must not use a reserved device name: ${segment}` };
        }
    }
    const base = segments[segments.length - 1];
    if (!base.endsWith(".md") || base === ".md") {
        return { ok: false, error: "outputPath must name a Markdown file ending in .md" };
    }
    return { ok: true, path: value };
}

/** Lowercase ASCII kebab slug of the question's leading words, never empty. */
export function slugifyTopic(question, maxLength = 60) {
    const words = String(question)
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .split(" ")
        .filter(Boolean);
    let slug = "";
    for (const word of words.slice(0, 8)) {
        const next = slug === "" ? word : `${slug}-${word}`;
        if (next.length > maxLength) break;
        slug = next;
    }
    if (slug === "") slug = words[0] ? words[0].slice(0, maxLength) : "architecture";
    return slug;
}

/** `docs/design/assessments/<YYYY-MM-DD>-<slug>-assessment.md` */
export function deriveReportPath(question, isoDate) {
    return `${ASSESSMENT_DIR}/${isoDate}-${slugifyTopic(question)}-assessment.md`;
}

/** Sibling `.html` of a validated `.md` report path. */
export function htmlCompanionPath(markdownPath) {
    return markdownPath.replace(/\.md$/, ".html");
}

/**
 * Validate the whole workflow args object: wrong types, unknown fields, and the output path policy.
 * @returns {{ ok: true, question: string, outputPath: string | null, html: boolean, overwrite: boolean } | { ok: false, error: string }}
 */
export function validateReportArgs(args) {
    if (args === null || typeof args !== "object" || Array.isArray(args)) {
        return { ok: false, error: "args must be an object" };
    }
    const unknown = Object.keys(args).filter((k) => !ARG_FIELDS.includes(k));
    if (unknown.length > 0) return { ok: false, error: `unknown args field(s): ${unknown.join(", ")}` };
    const q = normalizeQuestion(args.question);
    if (!q.ok) return q;
    for (const key of ["html", "overwrite"]) {
        if (args[key] !== undefined && typeof args[key] !== "boolean") {
            return { ok: false, error: `${key} must be a boolean` };
        }
    }
    let outputPath = null;
    if (args.outputPath !== undefined) {
        const p = validateOutputPath(args.outputPath);
        if (!p.ok) return p;
        outputPath = p.path;
    }
    return { ok: true, question: q.question, outputPath, html: args.html === true, overwrite: args.overwrite === true };
}

const TAG_OPEN = /<([a-zA-Z][^\s/>]*)/y;
const URL_ATTRIBUTES = new Set([
    "src", "srcset", "href", "xlink:href", "action", "formaction", "poster", "data", "background", "ping",
    "manifest", "codebase", "archive", "lowsrc", "dynsrc",
]);
const LINK_ATTRIBUTES = new Set(["href", "xlink:href"]);

/**
 * Yield each start tag's name and attributes, roughly as an HTML tokenizer reads them: a quoted value may contain `>`,
 * an unterminated quote runs to the end of the document, and comments are skipped. Text outside tags is never parsed.
 * @returns {Generator<{ tag: string, attrs: { name: string, value: string }[] }>}
 */
function* startTags(html) {
    const n = html.length;
    const space = (c) => c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f";
    let i = 0;
    while (i < n) {
        const lt = html.indexOf("<", i);
        if (lt === -1) return;
        if (html.startsWith("<!--", lt)) {
            const close = html.indexOf("-->", lt + 4);
            if (close === -1) return;
            i = close + 3;
            continue;
        }
        TAG_OPEN.lastIndex = lt;
        const m = TAG_OPEN.exec(html);
        if (!m) {
            i = lt + 1;
            continue;
        }
        let j = TAG_OPEN.lastIndex;
        const attrs = [];
        while (j < n) {
            while (j < n && (space(html[j]) || html[j] === "/")) j++;
            if (j >= n || html[j] === ">") break;
            let k = j + 1;
            while (k < n && !space(html[k]) && html[k] !== "/" && html[k] !== ">" && html[k] !== "=") k++;
            const name = html.slice(j, k).toLowerCase();
            j = k;
            while (j < n && space(html[j])) j++;
            let value = "";
            if (html[j] === "=") {
                j++;
                while (j < n && space(html[j])) j++;
                const quote = html[j];
                if (quote === '"' || quote === "'") {
                    const close = html.indexOf(quote, j + 1);
                    const stop = close === -1 ? n : close;
                    value = html.slice(j + 1, stop);
                    j = stop + 1;
                } else {
                    k = j;
                    while (k < n && !space(html[k]) && html[k] !== ">") k++;
                    value = html.slice(j, k);
                    j = k;
                }
            }
            attrs.push({ name, value });
        }
        yield { tag: m[1].toLowerCase(), attrs };
        i = j + 1;
    }
}

/** A URL value that leaves the document: any scheme except `data:`, or protocol-relative. */
function urlLeavesDocument(value) {
    const v = value.replace(/[\t\n\r]/g, "").trim().replace(/\\/g, "/");
    if (v.startsWith("//")) return true;
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(v);
    return scheme !== null && scheme[1].toLowerCase() !== "data";
}

/**
 * Reject active or external content in a report HTML document. Deterministic policy: no scripts, inline event
 * handlers (`on*` attributes inside a tag), javascript: URLs, embedding elements, meta refresh, or resource-loading
 * references (`src`, `srcset`, `<link>`, `@import`, `url()`, SVG `<image>`/`<use>` `href`, …) that leave the
 * document. Hyperlinks are allowed: an `<a>` element may carry an `href` to an `http:` or `https:` URL.
 * This is a best-effort denylist, not a sanitizer: it does not decode entities (e.g. `javascript&colon;` passes)
 * and passing it is no guarantee the HTML is safe.
 * @returns {string | null} a description of the first violation, or null when clean
 */
export function findActiveHtml(html) {
    const rules = [
        [/<\s*script\b/i, "<script> element"],
        [/<\s*(iframe|frame|frameset|object|embed|applet|base|form)\b/i, "embedding or form element"],
        [/<\s*meta\b[^>]*http-equiv/i, "<meta http-equiv>"],
        [/<\s*link\b/i, "<link> element"],
        [/(?:javascript|vbscript)\s*:/i, "javascript: URL"],
        [/@import\b/i, "@import"],
        [/url\(\s*["']?\s*(?:[a-z][a-z0-9+.-]*:(?<!data:)|\/\/|\\\\)/i, "external url() reference"],
        [/\bdata:\s*text\/html/i, "data:text/html URL"],
    ];
    for (const [re, label] of rules) if (re.test(html)) return label;
    for (const { tag, attrs } of startTags(html)) {
        for (const { name, value } of attrs) {
            if (/^on[a-z]/.test(name)) return "inline event handler";
            if (!URL_ATTRIBUTES.has(name) || !urlLeavesDocument(value)) continue;
            const hyperlink = tag === "a" && LINK_ATTRIBUTES.has(name) && /^https?:/i.test(value.replace(/[\t\n\r]/g, "").trim());
            if (!hyperlink) return `external URL attribute (${name} on <${tag}>)`;
        }
    }
    return null;
}

/**
 * Validate the report worker's structured result (content only). The receipt must match TEMPLATES.report.
 * @returns {{ ok: true, markdown: string, html: string | null, receipt: string } | { ok: false, error: string }}
 */
export function validateReportResult(result, htmlRequested) {
    if (result === null || typeof result !== "object" || Array.isArray(result)) {
        return { ok: false, error: "report worker returned no structured result" };
    }
    const { markdown, html, receipt } = result;
    if (typeof markdown !== "string" || markdown.trim() === "") {
        return { ok: false, error: "report markdown is empty" };
    }
    if (htmlRequested && (typeof html !== "string" || html.trim() === "")) {
        return { ok: false, error: "report html was requested but is empty" };
    }
    if (htmlRequested) {
        const violation = findActiveHtml(html);
        if (violation) return { ok: false, error: `report html contains disallowed active or external content: ${violation}` };
    }
    if (typeof receipt !== "string") return { ok: false, error: "report receipt must be a string" };
    const check = checkTemplate(receipt, TEMPLATES.report);
    if (!check.ok) return { ok: false, error: `report receipt is off template: ${check.problems.join("; ")}` };
    return { ok: true, markdown, html: htmlRequested ? html : null, receipt };
}

/**
 * Build the Report worker's prompt. It carries every input the report sections draw on: the scout's shared context
 * and reading of the question (section 1), the three designs and three judgements (section 7), the synthesis, the
 * paired refuter verdicts, the critique, and the run log.
 * @returns {string}
 */
export function buildReportPrompt({
    question,
    date,
    sharedContext,
    questionMeaning,
    designs,
    judgements,
    synthesis,
    pairedVerdicts,
    critique,
    coverage,
    markdownPath,
    htmlPath,
    wantHtml,
}) {
    return (
        `Question:\n${question}\n\nDate: ${date}\n\n` +
        `Shared context (from the scout):\n${sharedContext || "(none)"}\n\n` +
        `What the question means (the scout's reading of ambiguous terms):\n${questionMeaning || "(none)"}\n\n` +
        `The three designs:\n${designs}\n\nThe three judgements:\n${judgements}\n\n` +
        `Synthesis:\n${synthesis}\n\nRefuter verdicts paired with their claims:\n${pairedVerdicts || "(no reuse claims)"}\n\n` +
        `Critique:\n${critique}\n\nRun log (JSON):\n${JSON.stringify(coverage)}\n\n` +
        `Report path (for the receipt only; you write nothing): ${markdownPath}\n` +
        `HTML companion: ${wantHtml ? `requested (${htmlPath})` : "not requested; return html as null"}`
    );
}
