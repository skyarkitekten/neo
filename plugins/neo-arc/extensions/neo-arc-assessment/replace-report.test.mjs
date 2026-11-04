import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ASSESSMENT_DIR as D } from "./helpers.mjs";
import { replaceReportFiles } from "./report-write.mjs";

const MD = `${D}/r-assessment.md`;
const HTML = `${D}/r-assessment.html`;

async function withRoot(fn) {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "neo-arc-replace-")));
    try {
        await fn(root);
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
}

const abs = (root, rel) => path.join(root, rel);
const write = async (root, rel, content) => {
    await fs.mkdir(path.dirname(abs(root, rel)), { recursive: true });
    await fs.writeFile(abs(root, rel), content);
};
const read = (root, rel) => fs.readFile(abs(root, rel), "utf8");
const files = (md, html) => [
    { relPath: MD, content: md },
    ...(html === undefined ? [] : [{ relPath: HTML, content: html }]),
];
const noTemps = async (root) => {
    const names = await fs.readdir(path.join(root, D)).catch(() => []);
    assert.deepEqual(names.filter((n) => n.endsWith(".tmp")), []);
};

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

// Note: HTML safety policy (findActiveHtml) remains a best-effort denylist; these tests cover only file replacement.

test("replaceReportFiles replaces previous content with revised content (HTML policy stays a best-effort denylist)", () =>
    withRoot(async (root) => {
        await write(root, MD, "old md");
        assert.deepEqual(await replaceReportFiles(root, files("old md"), files("new md")), { [MD]: "overwritten" });
        assert.equal(await read(root, MD), "new md");
        await noTemps(root);
    }));

test("replaceReportFiles replays idempotently when files already hold revised content", () =>
    withRoot(async (root) => {
        await write(root, MD, "new md");
        await write(root, HTML, "new html");
        const status = await replaceReportFiles(root, files("old md", "old html"), files("new md", "new html"));
        assert.deepEqual(status, { [MD]: "unchanged", [HTML]: "unchanged" });
        assert.equal(await read(root, MD), "new md");
        await noTemps(root);
    }));

test("replaceReportFiles resumes a pair where one file is revised and the other still previous", () =>
    withRoot(async (root) => {
        await write(root, MD, "new md");
        await write(root, HTML, "old html");
        const status = await replaceReportFiles(root, files("old md", "old html"), files("new md", "new html"));
        assert.deepEqual(status, { [MD]: "unchanged", [HTML]: "overwritten" });
        assert.equal(await read(root, MD), "new md");
        assert.equal(await read(root, HTML), "new html");
        await noTemps(root);
    }));

test("replaceReportFiles rejects externally edited content and preserves it", () =>
    withRoot(async (root) => {
        await write(root, MD, "old md");
        await write(root, HTML, "human edit");
        await assert.rejects(replaceReportFiles(root, files("old md", "old html"), files("new md", "new html")), /changed outside/);
        assert.equal(await read(root, MD), "old md");
        assert.equal(await read(root, HTML), "human edit");
        await noTemps(root);
    }));

test("replaceReportFiles rejects a missing file, including a verify call with identical content", () =>
    withRoot(async (root) => {
        await assert.rejects(replaceReportFiles(root, files("a"), files("b")), /missing/);
        await assert.rejects(replaceReportFiles(root, files("x"), files("x")), /missing/);
        await write(root, MD, "old md");
        await assert.rejects(replaceReportFiles(root, files("old md", "old html"), files("new md", "new html")), /missing/);
        assert.equal(await read(root, MD), "old md");
        await noTemps(root);
    }));

test("replaceReportFiles verify call succeeds as unchanged when the file already matches", () =>
    withRoot(async (root) => {
        await write(root, MD, "x");
        assert.deepEqual(await replaceReportFiles(root, files("x"), files("x")), { [MD]: "unchanged" });
    }));

test("replaceReportFiles rejects mismatched or duplicate path sets", () =>
    withRoot(async (root) => {
        await write(root, MD, "a");
        await assert.rejects(replaceReportFiles(root, files("a"), files("b", "c")), /differ/);
        await assert.rejects(replaceReportFiles(root, [...files("a"), ...files("a")], [...files("b"), ...files("b")]), /duplicate/);
        assert.equal(await read(root, MD), "a");
    }));

test("replaceReportFiles refuses a symlinked destination and leaves the target alone", (t) =>
    withRoot(async (root) => {
        const target = path.join(root, "target.txt");
        await fs.writeFile(target, "old md");
        await fs.mkdir(path.join(root, D), { recursive: true });
        if (!(await trySymlink(t, target, abs(root, MD), "file"))) return;
        await assert.rejects(replaceReportFiles(root, files("old md"), files("new md")), /symlink/i);
        assert.equal(await fs.readFile(target, "utf8"), "old md");
        assert.ok((await fs.lstat(abs(root, MD))).isSymbolicLink());
        await noTemps(root);
    }));

test("replaceReportFiles refuses a symlinked parent directory", (t) =>
    withRoot(async (root) => {
        const outside = path.join(root, "outside");
        await fs.mkdir(outside);
        await fs.writeFile(path.join(outside, "r-assessment.md"), "old md");
        await fs.mkdir(path.join(root, "docs"));
        if (!(await trySymlink(t, outside, path.join(root, "docs", "design"), "dir"))) return;
        await assert.rejects(replaceReportFiles(root, files("old md"), files("new md")), /symlink/i);
        assert.equal(await fs.readFile(path.join(outside, "r-assessment.md"), "utf8"), "old md");
    }));

test("replaceReportFiles refuses a non-regular destination", () =>
    withRoot(async (root) => {
        await fs.mkdir(abs(root, MD), { recursive: true });
        await assert.rejects(replaceReportFiles(root, files("a"), files("b")), /not a regular file/);
        assert.ok((await fs.lstat(abs(root, MD))).isDirectory());
    }));

test("replaceReportFiles reports persisted status when the second file's commit fails", (t) =>
    withRoot(async (root) => {
        await write(root, MD, "old md");
        await write(root, HTML, "old html");
        const realRename = fs.rename;
        let calls = 0;
        t.mock.method(fs, "rename", async (from, to) => {
            calls += 1;
            if (calls === 2) throw Object.assign(new Error("injected rename failure"), { code: "EIO" });
            return realRename(from, to);
        });
        await assert.rejects(
            replaceReportFiles(root, files("old md", "old html"), files("new md", "new html")),
            (error) => {
                assert.match(error.message, /injected rename failure/);
                assert.deepEqual(error.persisted, { [MD]: "overwritten" });
                return true;
            },
        );
        t.mock.restoreAll();
        assert.equal(await read(root, MD), "new md");
        assert.equal(await read(root, HTML), "old html");
        await noTemps(root);
        // A rerun resumes the partial replacement.
        assert.deepEqual(await replaceReportFiles(root, files("old md", "old html"), files("new md", "new html")), {
            [MD]: "unchanged",
            [HTML]: "overwritten",
        });
    }));
