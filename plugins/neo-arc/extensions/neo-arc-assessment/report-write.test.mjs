import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
    ASSESSMENT_DIR,
    TEMPLATES,
    findActiveHtml,
    validateOutputPath,
    validateReportArgs,
    validateReportResult,
} from "./helpers.mjs";
import { persistReportFiles } from "./report-write.mjs";

const D = ASSESSMENT_DIR;

// ---- validateOutputPath ----

test("validateOutputPath accepts paths under the default folder", () => {
    for (const p of [`${D}/a.md`, `${D}/2026-01-02-topic-assessment.md`, `${D}/sub/dir/x_1.y-z.md`]) {
        assert.deepEqual(validateOutputPath(p), { ok: true, path: p });
    }
});

test("validateOutputPath rejects non-strings, bad shapes, folders and extensions", () => {
    const bad = [
        undefined,
        null,
        5,
        "",
        ` ${D}/a.md`,
        `${D}/a.md `,
        `/${D}/a.md`,
        `/etc/passwd.md`,
        `C:/${D}/a.md`,
        `${D}/../a.md`,
        `${D}/../../outside/a.md`,
        `docs/design/other/a.md`,
        `docs/design/assessments-evil/a.md`,
        `${D}`,
        `${D}/`,
        `${D}/a.txt`,
        `${D}/a.html`,
        `${D}/.md`,
        `${D}//a.md`,
        `${D}/./a.md`,
        `./${D}/a.md`,
        `${D}/a\\b.md`,
        `${D}/a\nb.md`,
        `${D}/a:b.md`,
        `${D}/a b.md`,
        `${D}/dir./a.md`,
        `${D}/a.md.`,
    ];
    for (const v of bad) assert.equal(validateOutputPath(v).ok, false, JSON.stringify(v));
});

test("validateOutputPath rejects Windows reserved device names", () => {
    for (const name of ["con", "PRN", "aux", "Nul", "com1", "LPT9", "con.md", "nul.txt.md"]) {
        const asFile = name.endsWith(".md") ? name : `${name}.md`;
        assert.equal(validateOutputPath(`${D}/${asFile}`).ok, false, asFile);
        assert.equal(validateOutputPath(`${D}/${name}/a.md`).ok, false, `dir ${name}`);
    }
    // Names that merely contain a device name are fine.
    assert.equal(validateOutputPath(`${D}/console.md`).ok, true);
});

test("validateOutputPath error mentions the invalid segment", () => {
    for (const segment of ["bad name", "a:b", "trail."]) {
        const r = validateOutputPath(`${D}/${segment}/x.md`);
        assert.equal(r.ok, false);
        assert.ok(r.error.includes(segment), r.error);
    }
    const reserved = validateOutputPath(`${D}/con.md`);
    assert.equal(reserved.ok, false);
    assert.ok(reserved.error.includes("con.md"), reserved.error);
});

// ---- validateReportArgs ----

test("validateReportArgs applies defaults", () => {
    assert.deepEqual(validateReportArgs({ question: "  How? " }), {
        ok: true,
        question: "How?",
        outputPath: null,
        html: false,
        overwrite: false,
    });
});

test("validateReportArgs accepts optional values", () => {
    assert.deepEqual(
        validateReportArgs({ question: "Q", outputPath: `${D}/q.md`, html: true, overwrite: true }),
        { ok: true, question: "Q", outputPath: `${D}/q.md`, html: true, overwrite: true },
    );
    assert.equal(validateReportArgs({ question: "Q", html: false, overwrite: false }).ok, true);
});

test("validateReportArgs rejects wrong types, unknown keys and bad paths", () => {
    const bad = [
        undefined,
        null,
        "q",
        ["q"],
        {},
        { question: "" },
        { question: 5 },
        { question: "Q", html: "yes" },
        { question: "Q", html: 1 },
        { question: "Q", overwrite: "true" },
        { question: "Q", outputPath: 5 },
        { question: "Q", outputPath: "../x.md" },
        { question: "Q", outputPath: null },
        { question: "Q", extra: true },
        { question: "Q", Html: true },
    ];
    for (const v of bad) assert.equal(validateReportArgs(v).ok, false, JSON.stringify(v));
});

// ---- findActiveHtml (best-effort denylist, not a sanitizer) ----

test("findActiveHtml flags each denylisted construct", () => {
    const rejected = {
        script: "<p>x</p><script>alert(1)</script>",
        "script spaced": "< SCRIPT src=a>",
        "event handler": '<img src="a.png" onerror="x()">',
        "event handler spaced": "<div onclick = 'x()'>",
        "javascript url": '<a href="javascript:alert(1)">x</a>',
        "javascript spaced": '<a href="JavaScript :x">x</a>',
        "vbscript url": '<a href="vbscript:x">x</a>',
        iframe: '<iframe src="#"></iframe>',
        object: "<object data=x></object>",
        embed: "<embed src=x>",
        form: '<form action="#"></form>',
        base: '<base href="#">',
        link: '<link rel="stylesheet" href="#">',
        "meta refresh": '<meta http-equiv="refresh" content="0;url=#">',
        "external src": '<img src="https://example.com/a.png">',
        "external stylesheet": '<link rel="stylesheet" href="https://example.com/a.css">',
        "external script": '<script src="https://example.com/a.js"></script>',
        "svg image href": '<svg><image href="https://example.com/a.png"/></svg>',
        "svg use xlink:href": '<svg><use xlink:href="https://example.com/s.svg#i"/></svg>',
        "protocol-relative link": '<a href="//example.com">x</a>',
        "non-http link": '<a href="ftp://example.com/f">x</a>',
        "link ping": '<a href="https://example.com" ping="https://example.com/t">x</a>',
        "handler after quoted >": '<a title="a>b" onclick="x()">x</a>',
        "handler after stray quote": "<div x' onclick=y()>",
        "uppercase handler": "<DIV ONCLICK=x()>",
        "protocol-relative": '<img src="//example.com/a.png">',
        "external srcset": "<img srcset='https://example.com/a.png 1x'>",
        "css import": "<style>@import 'a.css';</style>",
        "css url external": "<style>p{background:url(https://example.com/a.png)}</style>",
        "css url protocol-relative": '<style>p{background:url("//example.com/a.png")}</style>',
        "data text/html": '<a href="data:text/html;base64,AAAA">x</a>',
    };
    for (const [name, html] of Object.entries(rejected)) {
        const found = findActiveHtml(html);
        assert.equal(typeof found, "string", name);
        assert.ok(found.length > 0, name);
    }
});

test("findActiveHtml passes benign self-contained HTML (best-effort denylist only)", () => {
    const html = [
        "<!doctype html><html><head><meta charset='utf-8'><title>T</title>",
        "<style>body{font-family:sans-serif} .a{color:#333}</style></head><body>",
        "<h1>Report</h1><p>See <a href='#section-1'>section</a>.</p>",
        "<svg width='10' height='10'><rect width='10' height='10' fill='red'/></svg>",
        "<img alt='pixel' src='data:image/png;base64,iVBORw0KGgo='>",
        "<h2 id='section-1'>One</h2></body></html>",
    ].join("");
    assert.equal(findActiveHtml(html), null);
});

test("findActiveHtml allows http(s) hyperlinks and handler-like text outside tags", () => {
    const allowed = {
        "https link": '<p>Source: <a href="https://example.com/docs?a=1#b">docs</a></p>',
        "http link with target": "<a target=_blank href='http://example.com'>x</a>",
        "on-word in a cell": "<table><tr><td>one = per area</td></tr></table>",
        "on-word in code": "<code>onboarding=true</code>",
        "on-word in a comment": "<!-- <div onclick=x()> -->",
        "svg fragment url": "<svg><rect fill='url(#g)' width='1' height='1'/></svg>",
    };
    for (const [name, html] of Object.entries(allowed)) assert.equal(findActiveHtml(html), null, name);
    assert.equal(typeof findActiveHtml("<div onclick=\"x()\">x</div>"), "string");
});

// ---- validateReportResult ----

const receipt = (headings = TEMPLATES.report) => headings.map((h) => `## ${h}\ntext\n`).join("\n");
const goodHtml = "<html><body><p>ok</p></body></html>";

test("validateReportResult accepts a complete markdown-only result and drops html", () => {
    const r = validateReportResult({ markdown: "# R", html: goodHtml, receipt: receipt() }, false);
    assert.equal(r.ok, true);
    assert.equal(r.markdown, "# R");
    assert.equal(r.html, null);
    assert.equal(r.receipt, receipt());
});

test("validateReportResult requires non-empty markdown", () => {
    for (const markdown of [undefined, null, 5, "", "  \n"]) {
        assert.equal(validateReportResult({ markdown, receipt: receipt() }, false).ok, false, JSON.stringify(markdown));
    }
    for (const bad of [null, undefined, "x", []]) assert.equal(validateReportResult(bad, false).ok, false);
});

test("validateReportResult requires html only when requested", () => {
    assert.equal(validateReportResult({ markdown: "# R", receipt: receipt() }, false).ok, true);
    for (const html of [undefined, null, "", "  ", 5]) {
        assert.equal(validateReportResult({ markdown: "# R", html, receipt: receipt() }, true).ok, false, String(html));
    }
    const ok = validateReportResult({ markdown: "# R", html: goodHtml, receipt: receipt() }, true);
    assert.equal(ok.ok, true);
    assert.equal(ok.html, goodHtml);
});

test("validateReportResult rejects active html when html is requested", () => {
    const r = validateReportResult({ markdown: "# R", html: "<script>x()</script>", receipt: receipt() }, true);
    assert.equal(r.ok, false);
    assert.match(r.error, /script/i);
});

test("validateReportResult requires a receipt matching the report headings", () => {
    const bad = [
        undefined,
        null,
        "",
        "no headings",
        receipt(TEMPLATES.report.slice(0, 2)),
        receipt([...TEMPLATES.report].reverse()),
        receipt(["Written", "Grades carried", "Something else"]),
    ];
    for (const v of bad) {
        assert.equal(validateReportResult({ markdown: "# R", receipt: v }, false).ok, false, JSON.stringify(v));
    }
});

// ---- persistReportFiles ----

async function withRoot(fn) {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "neo-arc-report-")));
    try {
        await fn(root);
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
}

async function listAll(dir) {
    const out = [];
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        out.push(full);
        if (entry.isDirectory()) out.push(...(await listAll(full)));
    }
    return out;
}

const noTemps = async (root) => {
    const temps = (await listAll(root)).filter((p) => p.endsWith(".tmp"));
    assert.deepEqual(temps, []);
};

/** Create a symlink, or return false (reporting a skip) when the platform lacks permission. */
async function trySymlink(t, target, link, type) {
    try {
        await fs.symlink(target, link, type);
        return true;
    } catch (error) {
        if (error.code === "EPERM" || error.code === "EACCES" || error.code === "ENOSYS") {
            t.skip(`symlink creation not permitted on this platform (${error.code})`);
            return false;
        }
        throw error;
    }
}

const MD = `${D}/r-assessment.md`;
const HTML = `${D}/r-assessment.html`;

test("persistReportFiles creates files and parent directories", () =>
    withRoot(async (root) => {
        const status = await persistReportFiles(root, [{ relPath: MD, content: "# one\n" }], false);
        assert.deepEqual(status, { [MD]: "created" });
        assert.equal(await fs.readFile(path.join(root, MD), "utf8"), "# one\n");
        await noTemps(root);
    }));

test("persistReportFiles is a no-op for identical content", () =>
    withRoot(async (root) => {
        await persistReportFiles(root, [{ relPath: MD, content: "same" }], false);
        const before = await fs.stat(path.join(root, MD));
        const status = await persistReportFiles(root, [{ relPath: MD, content: "same" }], false);
        assert.deepEqual(status, { [MD]: "unchanged" });
        const after = await fs.stat(path.join(root, MD));
        assert.equal(after.ino, before.ino);
        assert.equal(after.mtimeMs, before.mtimeMs);
        await noTemps(root);
    }));

test("persistReportFiles refuses differing content without overwrite and leaves the file intact", () =>
    withRoot(async (root) => {
        await persistReportFiles(root, [{ relPath: MD, content: "old" }], false);
        await assert.rejects(persistReportFiles(root, [{ relPath: MD, content: "new" }], false), /overwrite/);
        await assert.rejects(persistReportFiles(root, [{ relPath: MD, content: "new" }], undefined), /overwrite/);
        assert.equal(await fs.readFile(path.join(root, MD), "utf8"), "old");
        await noTemps(root);
    }));

test("persistReportFiles overwrites differing content only when overwrite is true", () =>
    withRoot(async (root) => {
        await persistReportFiles(root, [{ relPath: MD, content: "old" }], false);
        const status = await persistReportFiles(root, [{ relPath: MD, content: "new" }], true);
        assert.deepEqual(status, { [MD]: "overwritten" });
        assert.equal(await fs.readFile(path.join(root, MD), "utf8"), "new");
        await noTemps(root);
    }));

test("persistReportFiles persists a sibling HTML pair and reports per-file status", () =>
    withRoot(async (root) => {
        const files = [
            { relPath: MD, content: "# md" },
            { relPath: HTML, content: "<p>html</p>" },
        ];
        assert.deepEqual(await persistReportFiles(root, files, false), { [MD]: "created", [HTML]: "created" });
        assert.equal(await fs.readFile(path.join(root, HTML), "utf8"), "<p>html</p>");
        assert.equal(path.dirname(path.join(root, MD)), path.dirname(path.join(root, HTML)));

        // Replay is idempotent; resuming after only one half exists creates the other.
        assert.deepEqual(await persistReportFiles(root, files, false), { [MD]: "unchanged", [HTML]: "unchanged" });
        await fs.rm(path.join(root, HTML));
        assert.deepEqual(await persistReportFiles(root, files, false), { [MD]: "unchanged", [HTML]: "created" });
        await noTemps(root);
    }));

test("persistReportFiles writes nothing when one file of a pair conflicts", () =>
    withRoot(async (root) => {
        await persistReportFiles(root, [{ relPath: HTML, content: "old html" }], false);
        await assert.rejects(
            persistReportFiles(
                root,
                [
                    { relPath: MD, content: "# md" },
                    { relPath: HTML, content: "new html" },
                ],
                false,
            ),
            /overwrite/,
        );
        await assert.rejects(fs.lstat(path.join(root, MD)), { code: "ENOENT" });
        assert.equal(await fs.readFile(path.join(root, HTML), "utf8"), "old html");
        await noTemps(root);
    }));

test("persistReportFiles rejects destinations that escape the root", () =>
    withRoot(async (root) => {
        await assert.rejects(persistReportFiles(root, [{ relPath: "../escape.md", content: "x" }], true));
        await assert.rejects(persistReportFiles(root, [{ relPath: "", content: "x" }], true));
        assert.deepEqual(await fs.readdir(root), []);
    }));

test("persistReportFiles rejects a non-directory parent and a directory destination", () =>
    withRoot(async (root) => {
        await fs.mkdir(path.join(root, "docs"));
        await fs.writeFile(path.join(root, "docs", "design"), "i am a file");
        await assert.rejects(persistReportFiles(root, [{ relPath: MD, content: "x" }], true));

        await fs.rm(path.join(root, "docs"), { recursive: true });
        await fs.mkdir(path.join(root, MD), { recursive: true });
        await assert.rejects(persistReportFiles(root, [{ relPath: MD, content: "x" }], true));
        await noTemps(root);
    }));

test("persistReportFiles rejects a symlinked parent directory", (t) =>
    withRoot(async (root) => {
        const outside = path.join(root, "outside");
        await fs.mkdir(outside);
        await fs.mkdir(path.join(root, "docs"));
        if (!(await trySymlink(t, outside, path.join(root, "docs", "design"), "dir"))) return;

        await assert.rejects(persistReportFiles(root, [{ relPath: MD, content: "x" }], true), /symlink/i);
        assert.deepEqual(await fs.readdir(outside), []);
        await noTemps(root);
    }));

test("persistReportFiles rejects a symlinked destination, even with overwrite", (t) =>
    withRoot(async (root) => {
        const target = path.join(root, "target.txt");
        await fs.writeFile(target, "precious");
        await fs.mkdir(path.join(root, D), { recursive: true });
        if (!(await trySymlink(t, target, path.join(root, MD), "file"))) return;

        for (const overwrite of [false, true]) {
            await assert.rejects(persistReportFiles(root, [{ relPath: MD, content: "x" }], overwrite), /symlink/i);
        }
        assert.equal(await fs.readFile(target, "utf8"), "precious");
        assert.ok((await fs.lstat(path.join(root, MD))).isSymbolicLink());
        await noTemps(root);
    }));
