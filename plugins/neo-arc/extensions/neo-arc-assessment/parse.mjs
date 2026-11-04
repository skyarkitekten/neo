// Narrow section/table parsing for neo-arc worker templates. No SDK, no I/O.
// This is deliberately not a Markdown parser: it knows `##` sections, one pipe table, and a first-word value.
import {
    FACTCHECK_COLUMNS,
    FACTCHECK_IMPACTS,
    FACTCHECK_KINDS,
    FACTCHECK_SEVERITIES,
    REUSE_GRADES,
} from "./helpers.mjs";

function headingMatches(text, name) {
    return text === name || (text.startsWith(name) && !/[A-Za-z0-9]/.test(text[name.length]));
}

/**
 * Body lines of the first `##` section whose heading is `name` (same boundary rule as checkTemplate).
 * Fenced code and `###`+ headings are body. Returns null when the section is absent.
 * @returns {string[] | null}
 */
export function sectionLines(reply, name) {
    if (typeof reply !== "string") return null;
    let fence = null;
    let body = null;
    for (const line of reply.split(/\r?\n/)) {
        const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
        if (fenceMatch) {
            const marker = fenceMatch[1][0];
            if (fence === null) fence = marker;
            else if (fence === marker) fence = null;
        } else if (fence === null) {
            const heading = /^##[ \t]+(.*?)[ \t]*#*[ \t]*$/.exec(line);
            if (heading) {
                if (body !== null) return body;
                if (headingMatches(heading[1], name)) body = [];
                continue;
            }
        }
        if (body !== null) body.push(line);
    }
    return body;
}

/** Section body as trimmed text, or null when the section is absent. */
export function sectionText(reply, name) {
    const lines = sectionLines(reply, name);
    return lines === null ? null : lines.join("\n").trim();
}

function splitRow(line) {
    const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/);
    return cells.map((c) => c.trim());
}

const SEPARATOR = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/;

/**
 * Parse the first pipe table in a section. The header must equal `columns` (case-insensitive),
 * a separator row must follow, and every data row must have exactly that many cells.
 * @returns {{ ok: true, rows: string[][] } | { ok: false, error: string }}
 */
export function parseTable(reply, section, columns) {
    const lines = sectionLines(reply, section);
    if (lines === null) return { ok: false, error: `section "${section}" is missing` };
    const start = lines.findIndex((l) => l.trim().startsWith("|"));
    if (start < 0) return { ok: false, error: `section "${section}" has no table` };
    const block = [];
    for (let i = start; i < lines.length && lines[i].trim().startsWith("|"); i++) block.push(lines[i]);
    const header = splitRow(block[0]);
    if (
        header.length !== columns.length ||
        header.some((h, i) => h.toLowerCase() !== columns[i].toLowerCase())
    ) {
        return { ok: false, error: `"${section}" table header must be: ${columns.join(" | ")}` };
    }
    if (block.length < 2 || !SEPARATOR.test(block[1].trim())) {
        return { ok: false, error: `"${section}" table has no separator row` };
    }
    const rows = [];
    for (const line of block.slice(2)) {
        const cells = splitRow(line);
        if (cells.length !== columns.length) {
            return { ok: false, error: `"${section}" table row has ${cells.length} cells, expected ${columns.length}` };
        }
        rows.push(cells);
    }
    return { ok: true, rows };
}

/** Strip wrapping backticks/asterisks/quotes and surrounding whitespace, lowercase. */
export function normalizeToken(value) {
    return String(value)
        .trim()
        .replace(/^[`*"'_\s]+|[`*"'_.\s]+$/g, "")
        .toLowerCase();
}

/**
 * Scout `## Areas` table → area rows. Fails on a malformed table, empty area names,
 * or (for a full assessment) a count outside 8–11.
 * @returns {{ ok: true, areas: { n: string, area: string, anchors: string, lookFor: string }[] } | { ok: false, error: string }}
 */
export function parseAreas(reply) {
    const table = parseTable(reply, "Areas", ["#", "Area", "Anchor files", "What to look for"]);
    if (!table.ok) return table;
    const areas = table.rows.map(([n, area, anchors, lookFor]) => ({ n, area, anchors, lookFor }));
    if (areas.some((a) => a.area === "")) return { ok: false, error: '"Areas" table has a row with no area name' };
    if (areas.length < 8 || areas.length > 11) {
        return { ok: false, error: `"Areas" table has ${areas.length} areas; a full assessment needs 8-11` };
    }
    return { ok: true, areas };
}

/**
 * Scout `## External product` → product text, or null for "none named".
 * @returns {{ ok: true, product: string | null } | { ok: false, error: string }}
 */
export function parseExternalProduct(reply) {
    const text = sectionText(reply, "External product");
    if (text === null || text === "") return { ok: false, error: '"External product" section is empty' };
    return { ok: true, product: normalizeToken(text) === "none named" ? null : text };
}

/**
 * Synthesizer reuse-claims table → claims with positional ids and a known grade.
 * @returns {{ ok: true, claims: { id: string, component: string, path: string, grade: string, how: string }[] } | { ok: false, error: string }}
 */
export function parseReuseClaims(reply) {
    const table = parseTable(reply, "Reuse claims the recommendation depends on", ["#", "Component", "Path", "Grade", "How"]);
    if (!table.ok) return table;
    const claims = [];
    for (const [i, [, component, path, rawGrade, how]] of table.rows.entries()) {
        const grade = normalizeToken(rawGrade);
        if (!REUSE_GRADES.includes(grade)) {
            return { ok: false, error: `reuse claim ${i + 1} has unknown grade "${rawGrade}"` };
        }
        claims.push({ id: `claim-${i + 1}`, component, path, grade, how });
    }
    return { ok: true, claims };
}

/**
 * Refuter reply → verdict fields from the first word of each section.
 * @returns {{ ok: true, verdict: string, confidence: string, correctedGrade: string } | { ok: false, error: string }}
 */
export function parseRefuterVerdict(reply) {
    // First whitespace-delimited token; same-line prose and trailing punctuation after it are ignored.
    const first = (name) => normalizeToken(((sectionText(reply, name) ?? "").split(/\s+/)[0] ?? "")).replace(/[,:;!?()[\]\s]+$/, "");
    const verdict = first("Verdict");
    const confidence = first("Confidence");
    const correctedGrade = first("Corrected grade");
    if (!["refuted", "holds"].includes(verdict)) return { ok: false, error: `verdict must be refuted or holds, got "${verdict}"` };
    if (!["high", "medium", "low"].includes(confidence)) {
        return { ok: false, error: `confidence must be high, medium or low, got "${confidence}"` };
    }
    if (!REUSE_GRADES.includes(correctedGrade)) {
        return { ok: false, error: `corrected grade must be one of ${REUSE_GRADES.join(", ")}, got "${correctedGrade}"` };
    }
    return { ok: true, verdict, confidence, correctedGrade };
}

/**
 * Factcheck reply → validated, normalized findings. `expectedKind` is a key of FACTCHECK_KINDS.
 * Requires the exact check kind, a non-empty `Checked`, and a `Findings` section holding only the table whose
 * header is FACTCHECK_COLUMNS. An empty table (header + separator only) means no findings. Severity must be exactly
 * error/warning/nit and Recommendation impact exactly yes/no/unclear; Claim, Problem, Evidence and Fix are required.
 * @returns {{ ok: true, kind: string, checked: string, findings: { severity: string, file: string, claim: string, problem: string, evidence: string, recommendationImpact: string, fix: string }[] } | { ok: false, error: string }}
 */
export function parseFactcheck(reply, expectedKind) {
    if (!Object.hasOwn(FACTCHECK_KINDS, expectedKind)) return { ok: false, error: `unknown check kind "${expectedKind}"` };
    const expected = FACTCHECK_KINDS[expectedKind];
    const kindText = sectionText(reply, "Check kind");
    if (kindText === null || kindText.toLowerCase() !== expected) {
        return { ok: false, error: `check kind must be exactly "${expected}", got "${kindText ?? ""}"` };
    }
    const checked = sectionText(reply, "Checked");
    if (!checked) return { ok: false, error: '"Checked" section is empty' };
    const lines = sectionLines(reply, "Findings");
    if (lines === null) return { ok: false, error: 'section "Findings" is missing' };
    if (lines.some((l) => l.trim() !== "" && !l.trim().startsWith("|"))) {
        return { ok: false, error: '"Findings" must contain only the findings table' };
    }
    let seenBlankAfterTable = false;
    let started = false;
    for (const l of lines) {
        if (l.trim() === "") seenBlankAfterTable = started;
        else if (seenBlankAfterTable) return { ok: false, error: '"Findings" must contain a single contiguous table' };
        else started = true;
    }
    const table = parseTable(reply, "Findings", FACTCHECK_COLUMNS);
    if (!table.ok) return table;
    const findings = [];
    for (const [i, cells] of table.rows.entries()) {
        const [severity, file, claim, problem, evidence, impact, fix] = cells;
        if (!FACTCHECK_SEVERITIES.includes(severity)) {
            return { ok: false, error: `finding ${i + 1} severity must be exactly error, warning or nit, got "${severity}"` };
        }
        if (!FACTCHECK_IMPACTS.includes(impact)) {
            return { ok: false, error: `finding ${i + 1} recommendation impact must be exactly yes, no or unclear, got "${impact}"` };
        }
        for (const [name, value] of [["claim", claim], ["problem", problem], ["evidence", evidence], ["fix", fix]]) {
            if (value === "") return { ok: false, error: `finding ${i + 1} has an empty ${name}` };
        }
        findings.push({ severity, file, claim, problem, evidence, recommendationImpact: impact, fix });
    }
    return { ok: true, kind: expected, checked, findings };
}
