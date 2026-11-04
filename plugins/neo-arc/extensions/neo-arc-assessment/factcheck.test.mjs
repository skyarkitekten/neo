import test from "node:test";
import assert from "node:assert/strict";
import { classifyFindings } from "./helpers.mjs";
import { parseFactcheck } from "./parse.mjs";

const HEADER = "| Severity | File | Claim | Problem | Evidence | Recommendation impact | Fix |";
const SEP = "| --- | --- | --- | --- | --- | --- | --- |";
const row = (severity = "error", impact = "no", over = {}) => {
    const c = { file: "src/a.ts", claim: "claim", problem: "problem", evidence: "evidence", fix: "fix", ...over };
    return `| ${severity} | ${c.file} | ${c.claim} | ${c.problem} | ${c.evidence} | ${impact} | ${c.fix} |`;
};
const reply = ({ kind = "repository facts", checked = "Read src/a.ts.", findings } = {}) => {
    const parts = [];
    if (kind !== null) parts.push(`## Check kind\n${kind}`);
    if (checked !== null) parts.push(`## Checked\n${checked}`);
    if (findings !== null) parts.push(`## Findings\n${findings ?? [HEADER, SEP].join("\n")}`);
    return `${parts.join("\n\n")}\n`;
};
const table = (...rows) => [HEADER, SEP, ...rows].join("\n");
const fail = (r) => assert.equal(r.ok, false);

test("parseFactcheck accepts an empty findings table as no findings", () => {
    assert.deepEqual(parseFactcheck(reply(), "repository-facts"), {
        ok: true,
        kind: "repository facts",
        checked: "Read src/a.ts.",
        findings: [],
    });
});

test("parseFactcheck normalizes a valid finding for every severity and impact", () => {
    for (const severity of ["error", "warning", "nit"]) {
        for (const impact of ["yes", "no", "unclear"]) {
            const r = parseFactcheck(reply({ findings: table(row(severity, impact)) }), "repository-facts");
            assert.deepEqual(r.findings, [
                {
                    severity,
                    file: "src/a.ts",
                    claim: "claim",
                    problem: "problem",
                    evidence: "evidence",
                    recommendationImpact: impact,
                    fix: "fix",
                },
            ]);
        }
    }
});

test("parseFactcheck preserves row order and accepts each assigned check kind", () => {
    const r = parseFactcheck(reply({ findings: table(row("nit", "no", { claim: "first" }), row("error", "yes", { claim: "second" })) }), "repository-facts");
    assert.deepEqual(r.findings.map((f) => f.claim), ["first", "second"]);
    for (const [id, text] of [["external-claims", "external claims"], ["document-structure", "document structure"]]) {
        const k = parseFactcheck(reply({ kind: text }), id);
        assert.equal(k.ok, true);
        assert.equal(k.kind, text);
    }
});

test("parseFactcheck rejects a check kind that differs from the assigned one or is unknown", () => {
    fail(parseFactcheck(reply({ kind: "external claims" }), "repository-facts"));
    fail(parseFactcheck(reply({ kind: "repository facts and more" }), "repository-facts"));
    fail(parseFactcheck(reply({ kind: null }), "repository-facts"));
    fail(parseFactcheck(reply(), "no-such-kind"));
    fail(parseFactcheck(reply(), "toString"));
});

test("parseFactcheck rejects a missing or empty Checked section", () => {
    fail(parseFactcheck(reply({ checked: null }), "repository-facts"));
    fail(parseFactcheck(reply({ checked: "" }), "repository-facts"));
    fail(parseFactcheck(reply({ checked: "   " }), "repository-facts"));
});

test("parseFactcheck rejects a missing Findings section or table", () => {
    fail(parseFactcheck(reply({ findings: null }), "repository-facts"));
    fail(parseFactcheck(reply({ findings: "" }), "repository-facts"));
});

test("parseFactcheck rejects malformed, wrong and reordered table headers", () => {
    const bad = [
        "| Severity | File | Claim | Problem | Evidence | Fix |",
        "| Severity | File | Claim | Problem | Evidence | Recommendation impact | Fix | Extra |",
        "| Severity | Claim | File | Problem | Evidence | Recommendation impact | Fix |",
        "| Impact | File | Claim | Problem | Evidence | Recommendation impact | Fix |",
        "| Fix | Recommendation impact | Evidence | Problem | Claim | File | Severity |",
    ];
    for (const header of bad) fail(parseFactcheck(reply({ findings: [header, SEP].join("\n") }), "repository-facts"));
    fail(parseFactcheck(reply({ findings: [HEADER, row()].join("\n") }), "repository-facts")); // no separator
});

test("parseFactcheck rejects a severity or impact that is not exact", () => {
    for (const severity of ["critical", "Error", "errors", "", "error, warning"]) {
        fail(parseFactcheck(reply({ findings: table(row(severity)) }), "repository-facts"));
    }
    for (const impact of ["maybe", "Yes", "none", "", "yes."]) {
        fail(parseFactcheck(reply({ findings: table(row("error", impact)) }), "repository-facts"));
    }
});

test("parseFactcheck rejects empty claim, problem, evidence or fix but allows an empty file", () => {
    for (const field of ["claim", "problem", "evidence", "fix"]) {
        fail(parseFactcheck(reply({ findings: table(row("error", "no", { [field]: "" })) }), "repository-facts"));
    }
    const r = parseFactcheck(reply({ findings: table(row("error", "no", { file: "" })) }), "repository-facts");
    assert.equal(r.ok, true);
    assert.equal(r.findings[0].file, "");
});

test("parseFactcheck rejects malformed rows and stray text in Findings", () => {
    fail(parseFactcheck(reply({ findings: table("| error | a.ts | claim | problem |") }), "repository-facts"));
    fail(parseFactcheck(reply({ findings: table(row() + " extra |") }), "repository-facts"));
    fail(parseFactcheck(reply({ findings: `No problems found.\n${table()}` }), "repository-facts"));
    fail(parseFactcheck(reply({ findings: `${table(row())}\nTrailing note.` }), "repository-facts"));
    fail(parseFactcheck(reply({ findings: `${table(row())}\n\n${table(row())}` }), "repository-facts"));
});

test("parseFactcheck keeps an escaped pipe inside one cell", () => {
    const r = parseFactcheck(reply({ findings: table(row("warning", "no", { claim: "a\\|b" })) }), "repository-facts");
    assert.equal(r.ok, true);
    assert.equal(r.findings.length, 1);
    assert.equal(r.findings[0].claim, "a\\|b");
    assert.equal(r.findings[0].fix, "fix");
});

// ---- classifyFindings ----

const f = (severity, recommendationImpact) => ({ severity, recommendationImpact });

test("classifyFindings returns zeroed output for no findings", () => {
    assert.deepEqual(classifyFindings([]), {
        counts: { error: 0, warning: 0, nit: 0 },
        recommendationImpact: "no",
        blocking: [],
        actionable: [],
        nits: [],
    });
});

test("classifyFindings counts severities and treats error/warning with impact no as actionable", () => {
    const e = f("error", "no");
    const w = f("warning", "no");
    const r = classifyFindings([e, w, e]);
    assert.deepEqual(r.counts, { error: 2, warning: 1, nit: 0 });
    assert.deepEqual(r.actionable, [e, w, e]);
    assert.deepEqual(r.blocking, []);
    assert.deepEqual(r.nits, []);
    assert.equal(r.recommendationImpact, "no");
});

test("classifyFindings keeps nits with impact no advisory only", () => {
    const n = f("nit", "no");
    const r = classifyFindings([n]);
    assert.deepEqual(r.counts, { error: 0, warning: 0, nit: 1 });
    assert.deepEqual(r.nits, [n]);
    assert.deepEqual(r.actionable, []);
    assert.deepEqual(r.blocking, []);
});

test("classifyFindings blocks every finding whose impact is yes or unclear, including nits", () => {
    const all = [];
    for (const severity of ["error", "warning", "nit"]) for (const impact of ["yes", "unclear"]) all.push(f(severity, impact));
    const r = classifyFindings(all);
    assert.deepEqual(r.blocking, all);
    assert.deepEqual(r.actionable, []);
    assert.deepEqual(r.nits, []);
    assert.deepEqual(r.counts, { error: 2, warning: 2, nit: 2 });
});

test("classifyFindings reports the worst-case recommendation impact", () => {
    assert.equal(classifyFindings([f("nit", "unclear"), f("error", "no")]).recommendationImpact, "unclear");
    assert.equal(classifyFindings([f("nit", "unclear"), f("warning", "yes")]).recommendationImpact, "yes");
});
