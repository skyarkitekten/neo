import test from "node:test";
import assert from "node:assert/strict";
import {
    TEMPLATES,
    checkTemplate,
    nextAttempt,
    normalizeQuestion,
    propagateGrades,
    startAttempt,
    summarizeCoverage,
} from "./helpers.mjs";

const build = (headings, body = "text") => headings.map((h) => `## ${h}\n${body}\n`).join("\n");

test("normalizeQuestion trims valid input", () => {
    assert.deepEqual(normalizeQuestion("  How? \n"), { ok: true, question: "How?" });
});

test("normalizeQuestion rejects non-string, empty and whitespace input", () => {
    for (const v of [undefined, null, 5, {}, [], "", "   \n\t"]) {
        const r = normalizeQuestion(v);
        assert.equal(r.ok, false);
        assert.equal(typeof r.error, "string");
    }
});

// Independent literals copied from the architecture-engineer "Template checklist".
const EXPECTED = {
    scout: ["Question", "Shared context", "What the question means", "Repository state", "Governing documents", "Keyword hits", "Areas", "External product"],
    reader: ["Area", "Summary", "Existing mentions of", "Reuse claims", "Gaps", "Constraints", "Facts"],
    designer: ["Name and thesis", "What the capability means here", "Stages", "New components", "Reused components", "Configuration", "ADR impact", "PRD sections touched", "Human gates", "Risks", "Open questions for the user", "Rough effort"],
    judge: ["Lens", "Scores", "Winner", "Graft from the others", "Factual errors spotted"],
    synthesizer: ["Recommendation", "Phased plan", "Reuse claims the recommendation depends on", "Not reusable", "ADR work", "PRD work", "Decisions only the user can make", "Judge disagreements"],
    refuter: ["Claim", "Verdict", "Confidence", "Reason", "Evidence", "Corrected grade"],
    critic: ["Missing", "Unverified claims", "Premature or overbuilt", "Sharpest question for the user"],
    report: ["Written", "Grades carried", "Unread areas"],
    factcheck: ["Check kind", "Checked", "Findings"],
};

test("TEMPLATES matches the orchestrator checklist exactly, in order", () => {
    assert.deepEqual(TEMPLATES, EXPECTED);
});

test("checkTemplate accepts a template generated from the literals for every key", () => {
    for (const [key, headings] of Object.entries(EXPECTED)) {
        const r = checkTemplate(build(headings), TEMPLATES[key]);
        assert.deepEqual(r, { ok: true, problems: [] }, key);
    }
});

test("checkTemplate rejects wrong order, missing and extra headings", () => {
    const req = TEMPLATES.report;
    assert.equal(checkTemplate(build([req[1], req[0], req[2]]), req).ok, false);
    assert.equal(checkTemplate(build(req.slice(0, 2)), req).ok, false);
    assert.match(checkTemplate(build(req.slice(0, 2)), req).problems.join("\n"), /missing heading/);
    const extra = checkTemplate(build([...req, "Bonus"]), req);
    assert.equal(extra.ok, false);
    assert.match(extra.problems.join("\n"), /expected 3 headings, found 4/);
});

test("checkTemplate rejects preamble", () => {
    const req = TEMPLATES.report;
    const r = checkTemplate(`Sure, here you go:\n\n${build(req)}`, req);
    assert.equal(r.ok, false);
    assert.match(r.problems.join("\n"), /before the first heading/);
});

test("checkTemplate allows suffix after a non-alphanumeric boundary only", () => {
    const req = TEMPLATES.report;
    assert.equal(checkTemplate(build(["Written (2)", "Grades carried: x", "Unread areas"]), req).ok, true);
    assert.equal(checkTemplate(build(["Writtenness", "Grades carried", "Unread areas"]), req).ok, false);
});

test("checkTemplate ignores headings inside fenced blocks and deeper headings", () => {
    const req = TEMPLATES.report;
    const reply = [
        "## Written",
        "```md",
        "## Fake",
        "```",
        "### Sub",
        "## Grades carried",
        "~~~",
        "## Also fake",
        "~~~",
        "## Unread areas",
    ].join("\n");
    assert.deepEqual(checkTemplate(reply, req), { ok: true, problems: [] });
});

test("checkTemplate rejects empty and non-string replies", () => {
    for (const v of [undefined, null, 3, {}, "", "  \n "]) {
        assert.deepEqual(checkTemplate(v, TEMPLATES.report), { ok: false, problems: ["reply is empty"] });
    }
});

test("startAttempt returns pending with zero attempts", () => {
    assert.deepEqual(startAttempt(), { status: "pending", attempts: 0 });
});

test("nextAttempt: pending on-template is accepted", () => {
    assert.deepEqual(nextAttempt(startAttempt(), true), { status: "accepted", attempts: 1 });
});

test("nextAttempt: pending off-template retries; retry success accepts; retry failure fails", () => {
    const retry = nextAttempt(startAttempt(), false);
    assert.deepEqual(retry, { status: "retry", attempts: 1 });
    assert.deepEqual(nextAttempt(retry, true), { status: "accepted", attempts: 2 });
    assert.deepEqual(nextAttempt(retry, false), { status: "failed", attempts: 2 });
});

test("nextAttempt: terminal states are unchanged", () => {
    for (const s of [
        { status: "accepted", attempts: 1 },
        { status: "failed", attempts: 2 },
    ]) {
        assert.equal(nextAttempt(s, true), s);
        assert.equal(nextAttempt(s, false), s);
    }
});

test("nextAttempt never exceeds two attempts, even for forged state", () => {
    const forged = [1, 2, 3, 99, NaN, -5, Infinity, -Infinity, 1.7];
    for (const status of ["pending", "retry", "bogus"]) {
        for (const attempts of forged) {
            for (const on of [true, false]) {
                const r = nextAttempt({ status, attempts }, on);
                assert.ok(r.attempts >= 1 && r.attempts <= 2, `${status}/${attempts}/${on}`);
                assert.ok(["accepted", "retry", "failed"].includes(r.status));
                if (r.status === "retry") assert.ok(r.attempts < 2);
            }
        }
    }
    assert.deepEqual(nextAttempt({ status: "pending", attempts: 1 }, false), { status: "failed", attempts: 2 });
    assert.deepEqual(nextAttempt({ status: "pending", attempts: 2 }, true), { status: "accepted", attempts: 2 });
    assert.deepEqual(nextAttempt({ status: "pending", attempts: NaN }, false), { status: "retry", attempts: 1 });
    assert.deepEqual(nextAttempt({ status: "pending", attempts: -3 }, false), { status: "retry", attempts: 1 });
    assert.deepEqual(nextAttempt({ status: "pending", attempts: Infinity }, false), { status: "retry", attempts: 1 });
});

test("nextAttempt treats unknown statuses as pending", () => {
    assert.deepEqual(nextAttempt({ status: "weird", attempts: 0 }, false), { status: "retry", attempts: 1 });
    assert.deepEqual(nextAttempt({ status: "weird", attempts: 0 }, true), { status: "accepted", attempts: 1 });
});

test("summarizeCoverage counts accepted, retried, failed and missing units", () => {
    const requested = ["a", "b", "c", "d"];
    const results = {
        a: { status: "accepted", attempts: 1, output: "x" },
        b: { status: "accepted", attempts: 2, output: "y" },
        c: { status: "failed", attempts: 2 },
    };
    assert.deepEqual(summarizeCoverage(requested, results), {
        requested,
        read: ["a", "b"],
        unread: ["c", "d"],
        stages: { success: 1, retry: 1, failure: 2 },
    });
});

test("summarizeCoverage keeps accepted units whose output is falsy", () => {
    const requested = ["zero", "no", "empty"];
    const results = {
        zero: { status: "accepted", attempts: 1, output: 0 },
        no: { status: "accepted", attempts: 1, output: false },
        empty: { status: "accepted", attempts: 2, output: "" },
    };
    const r = summarizeCoverage(requested, results);
    assert.deepEqual(r.read, requested);
    assert.deepEqual(r.unread, []);
    assert.deepEqual(r.stages, { success: 2, retry: 1, failure: 0 });
});

test("summarizeCoverage copies requested and ignores inherited result keys", () => {
    const requested = ["toString"];
    const r = summarizeCoverage(requested, {});
    assert.deepEqual(r.unread, ["toString"]);
    assert.notEqual(r.requested, requested);
});

test("propagateGrades replaces grade with corrected grade and keeps originalGrade", () => {
    const out = propagateGrades([{ id: "c1", grade: "verbatim", note: "n" }], {
        c1: { verdict: "partly", confidence: "high", correctedGrade: " extend " },
    });
    assert.deepEqual(out, [
        {
            id: "c1",
            grade: "extend",
            note: "n",
            originalGrade: "verbatim",
            unverified: false,
            verdict: "partly",
            confidence: "high",
        },
    ]);
});

test("propagateGrades marks missing or invalid corrections unverified and keeps grade", () => {
    const claims = [
        { id: "missing", grade: "verbatim" },
        { id: "bad", grade: "extend" },
        { id: "nonstring", grade: "pattern-only" },
        { id: "empty", grade: "not-reusable" },
    ];
    const out = propagateGrades(claims, {
        bad: { correctedGrade: "excellent" },
        nonstring: { correctedGrade: 3 },
        empty: {},
    });
    for (const [i, c] of claims.entries()) {
        assert.equal(out[i].grade, c.grade);
        assert.equal(out[i].originalGrade, c.grade);
        assert.equal(out[i].unverified, true);
    }
});
