import test from "node:test";
import assert from "node:assert/strict";
import { REUSE_GRADES } from "./helpers.mjs";
import { parseAreas, parseExternalProduct, parseReuseClaims, parseRefuterVerdict } from "./parse.mjs";

const AREA_HEADER = "| # | Area | Anchor files | What to look for |\n| --- | --- | --- | --- |";
const areaRow = (i) => `| ${i} | Area ${i} | src/a${i}.ts, src/b${i}.ts | look ${i} |`;
const areasReply = (count, { header = AREA_HEADER, extra = "" } = {}) =>
    `## Areas\n\n${header}\n${Array.from({ length: count }, (_, i) => areaRow(i + 1)).join("\n")}${extra}\n\n## Other\nx\n`;

test("parseAreas accepts 8 and 11 rows and preserves row fields", () => {
    for (const count of [8, 11]) {
        const r = parseAreas(areasReply(count));
        assert.equal(r.ok, true);
        assert.equal(r.areas.length, count);
    }
    const r = parseAreas(areasReply(8));
    assert.deepEqual(r.areas[2], { n: "3", area: "Area 3", anchors: "src/a3.ts, src/b3.ts", lookFor: "look 3" });
});

test("parseAreas rejects 7 and 12 rows", () => {
    assert.equal(parseAreas(areasReply(7)).ok, false);
    assert.equal(parseAreas(areasReply(12)).ok, false);
});

test("parseAreas rejects missing section, no table, wrong header, missing separator", () => {
    assert.equal(parseAreas("## Other\nnothing").ok, false);
    assert.equal(parseAreas("").ok, false);
    assert.equal(parseAreas("## Areas\n\nno table here").ok, false);
    assert.equal(parseAreas(areasReply(8, { header: "| # | Name | Anchor files | What to look for |\n| --- | --- | --- | --- |" })).ok, false);
    assert.equal(parseAreas(areasReply(8, { header: "| # | Area | Anchor files |\n| --- | --- | --- |" })).ok, false);
    assert.equal(parseAreas(areasReply(8, { header: "| # | Area | Anchor files | What to look for |" })).ok, false);
});

test("parseAreas rejects ragged rows and empty area names", () => {
    assert.equal(parseAreas(areasReply(8, { extra: "\n| 9 | Area 9 | only three |" })).ok, false);
    assert.equal(parseAreas(areasReply(8, { extra: "\n| 9 | A | b | c | d |" })).ok, false);
    assert.equal(parseAreas(areasReply(8, { extra: "\n| 9 |  | src/x | look |" })).ok, false);
});

test("parseExternalProduct returns null for exact 'none named'", () => {
    assert.deepEqual(parseExternalProduct("## External product\nnone named\n"), { ok: true, product: null });
});

test("parseExternalProduct preserves a named product", () => {
    assert.deepEqual(parseExternalProduct("## External product\n\nAcme Gateway (https://acme.example)\n\n## Areas\nx"), {
        ok: true,
        product: "Acme Gateway (https://acme.example)",
    });
});

test("parseExternalProduct rejects missing or empty section", () => {
    assert.equal(parseExternalProduct("## Areas\nx").ok, false);
    assert.equal(parseExternalProduct("## External product\n\n## Areas\nx").ok, false);
    assert.equal(parseExternalProduct("## External product\n").ok, false);
});

const CLAIM_HEADING = "## Reuse claims the recommendation depends on";
const CLAIM_HEADER = "| # | Component | Path | Grade | How |\n| --- | --- | --- | --- | --- |";
const claimsReply = (rows) => `${CLAIM_HEADING}\n\n${CLAIM_HEADER}\n${rows.join("\n")}\n`;

test("parseReuseClaims accepts every grade, with positional ids and order preserved", () => {
    const rows = REUSE_GRADES.map((g, i) => `| ${i + 1} | Comp${i} | src/c${i}.ts | ${g} | how ${i} |`);
    const r = parseReuseClaims(claimsReply(rows));
    assert.equal(r.ok, true);
    assert.deepEqual(
        r.claims.map((c) => [c.id, c.component, c.path, c.grade, c.how]),
        REUSE_GRADES.map((g, i) => [`claim-${i + 1}`, `Comp${i}`, `src/c${i}.ts`, g, `how ${i}`]),
    );
});

test("parseReuseClaims normalizes wrapped grades", () => {
    const r = parseReuseClaims(claimsReply(["| 1 | C | p | `Verbatim` | h |", "| 2 | D | q | **extend** | h |"]));
    assert.equal(r.ok, true);
    assert.deepEqual(r.claims.map((c) => c.grade), ["verbatim", "extend"]);
});

test("parseReuseClaims rejects unknown grade", () => {
    const r = parseReuseClaims(claimsReply(["| 1 | C | p | verbatim | h |", "| 2 | D | q | reusable | h |"]));
    assert.equal(r.ok, false);
    assert.equal(parseReuseClaims(claimsReply(["| 1 | C | p |  | h |"])).ok, false);
});

test("parseReuseClaims does not succeed on malformed tables", () => {
    assert.equal(parseReuseClaims("nothing").ok, false);
    assert.equal(parseReuseClaims(`${CLAIM_HEADING}\n\nno table`).ok, false);
    assert.equal(parseReuseClaims(`${CLAIM_HEADING}\n\n| # | Component | Path | Grade |\n| --- | --- | --- | --- |\n| 1 | C | p | verbatim |`).ok, false);
    assert.equal(parseReuseClaims(`${CLAIM_HEADING}\n\n| # | Component | Path | Grade | How |\n| 1 | C | p | verbatim | h |`).ok, false);
    assert.equal(parseReuseClaims(claimsReply(["| 1 | C | p | verbatim |"])).ok, false);
});

const verdictReply = (v, c, g) => `## Verdict\n${v}\n\n## Confidence\n${c}\n\n## Corrected grade\n${g}\n`;

test("parseRefuterVerdict accepts all verdict/confidence/grade combinations", () => {
    for (const verdict of ["refuted", "holds"]) {
        for (const confidence of ["high", "medium", "low"]) {
            for (const grade of REUSE_GRADES) {
                assert.deepEqual(parseRefuterVerdict(verdictReply(verdict, confidence, grade)), {
                    ok: true,
                    verdict,
                    confidence,
                    correctedGrade: grade,
                });
            }
        }
    }
});

test("parseRefuterVerdict normalizes case, wrapping and trailing punctuation", () => {
    const r = parseRefuterVerdict(verdictReply("**Holds**", "`High`.", '"Pattern-Only".'));
    assert.deepEqual(r, { ok: true, verdict: "holds", confidence: "high", correctedGrade: "pattern-only" });
    const r2 = parseRefuterVerdict(verdictReply("  REFUTED.  ", "_medium_", "'not-reusable'"));
    assert.deepEqual(r2, { ok: true, verdict: "refuted", confidence: "medium", correctedGrade: "not-reusable" });
});

test("parseRefuterVerdict ignores explanatory prose on following lines", () => {
    const r = parseRefuterVerdict(verdictReply("holds\nbecause the path exists", "low\nmore", "extend\nnotes"));
    assert.deepEqual(r, { ok: true, verdict: "holds", confidence: "low", correctedGrade: "extend" });
});

test("parseRefuterVerdict takes the first word when prose follows on the same line", () => {
    const r = parseRefuterVerdict(verdictReply("holds because the path exists", "high - sure", "extend (see notes)"));
    assert.deepEqual(r, { ok: true, verdict: "holds", confidence: "high", correctedGrade: "extend" });
    const r2 = parseRefuterVerdict(verdictReply("**holds** - ok", "`medium` - mostly", "_pattern-only_ close"));
    assert.deepEqual(r2, { ok: true, verdict: "holds", confidence: "medium", correctedGrade: "pattern-only" });
    const r3 = parseRefuterVerdict(verdictReply("refuted: no such file", "low (guess)", "not-reusable; see above"));
    assert.deepEqual(r3, { ok: true, verdict: "refuted", confidence: "low", correctedGrade: "not-reusable" });
});

test("parseRefuterVerdict still rejects an invalid first word followed by valid prose", () => {
    assert.equal(parseRefuterVerdict(verdictReply("maybe holds", "high", "extend")).ok, false);
});

test("parseRefuterVerdict rejects missing or invalid values", () => {
    assert.equal(parseRefuterVerdict("").ok, false);
    assert.equal(parseRefuterVerdict("## Confidence\nhigh\n## Corrected grade\nextend").ok, false);
    assert.equal(parseRefuterVerdict("## Verdict\nholds\n## Corrected grade\nextend").ok, false);
    assert.equal(parseRefuterVerdict("## Verdict\nholds\n## Confidence\nhigh").ok, false);
    assert.equal(parseRefuterVerdict(verdictReply("maybe", "high", "extend")).ok, false);
    assert.equal(parseRefuterVerdict(verdictReply("holds", "certain", "extend")).ok, false);
    assert.equal(parseRefuterVerdict(verdictReply("holds", "high", "reusable")).ok, false);
    assert.equal(parseRefuterVerdict(verdictReply("", "high", "extend")).ok, false);
});
