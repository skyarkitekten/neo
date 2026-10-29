// Filesystem boundary for the neo-arc-assessment workflow: the only module that writes durable files.
// It persists validated report files (see helpers.mjs validateOutputPath) and nothing else.
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/** Nearest ancestor of `startDir` holding a `.git` entry (directory, or file for worktrees/submodules). */
export async function findGitRoot(startDir) {
    let dir = path.resolve(startDir);
    for (;;) {
        try {
            await fs.lstat(path.join(dir, ".git"));
            return await fs.realpath(dir);
        } catch (error) {
            if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
        }
        const parent = path.dirname(dir);
        if (parent === dir) throw new Error(`no Git repository found at or above ${startDir}`);
        dir = parent;
    }
}

async function lstatOrNull(target) {
    try {
        return await fs.lstat(target);
    } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
    }
}

/**
 * Walk the parent directories of `relPath` under `root`, rejecting any symlink or non-directory.
 * With `create`, missing directories are made one level at a time (never through a symlink).
 * Returns the parent directory's absolute path.
 */
async function walkParents(root, relPath, create) {
    const segments = relPath.split("/");
    let current = root;
    for (const segment of segments.slice(0, -1)) {
        current = path.join(current, segment);
        let stat = await lstatOrNull(current);
        if (stat === null && create) {
            try {
                await fs.mkdir(current);
            } catch (error) {
                if (error.code !== "EEXIST") throw error;
            }
            stat = await lstatOrNull(current);
        }
        if (stat === null) return { dir: current, exists: false };
        if (stat.isSymbolicLink()) throw new Error(`refusing symlink path component: ${relPath} (${segment})`);
        if (!stat.isDirectory()) throw new Error(`path component is not a directory: ${relPath} (${segment})`);
    }
    return { dir: current, exists: true };
}

function assertContained(root, relPath) {
    const rel = path.relative(root, path.resolve(root, relPath));
    if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
        throw new Error(`destination escapes the repository: ${relPath}`);
    }
}

/** Decide, without writing, what persisting `content` at `relPath` would do: "create", "unchanged", or "overwrite". */
async function plan(root, file, overwrite) {
    assertContained(root, file.relPath);
    const { dir, exists } = await walkParents(root, file.relPath, false);
    if (!exists) return "create";
    const dest = path.join(dir, path.basename(file.relPath));
    const stat = await lstatOrNull(dest);
    if (stat === null) return "create";
    if (stat.isSymbolicLink()) throw new Error(`refusing symlink destination: ${file.relPath}`);
    if (!stat.isFile()) throw new Error(`destination exists and is not a regular file: ${file.relPath}`);
    if ((await fs.readFile(dest, "utf8")) === file.content) return "unchanged";
    if (!overwrite) {
        throw new Error(`destination already exists with different content (pass overwrite:true to replace): ${file.relPath}`);
    }
    return "overwrite";
}

/**
 * Write the content to a same-directory temp file (flags `wx`) after proving the parent is the validated real path.
 * This narrows the window; it does not defend against a concurrent local attacker swapping a parent directory for a
 * symlink after this check, because the later link()/rename() calls use path strings, not directory handles.
 */
async function stage(root, file) {
    const { dir } = await walkParents(root, file.relPath, true);
    // Containment proof: the real parent directory is exactly where the validated path says it is.
    const expected = path.join(root, ...file.relPath.split("/").slice(0, -1));
    if ((await fs.realpath(dir)) !== expected) throw new Error(`destination parent resolved outside its path: ${file.relPath}`);
    const dest = path.join(dir, path.basename(file.relPath));
    const temp = path.join(dir, `.${path.basename(file.relPath)}.${process.pid}-${randomBytes(6).toString("hex")}.tmp`);
    try {
        const handle = await fs.open(temp, "wx", 0o644);
        try {
            await handle.writeFile(file.content, "utf8");
            await handle.sync();
        } finally {
            await handle.close();
        }
    } catch (error) {
        await fs.rm(temp, { force: true });
        throw error;
    }
    return { dest, temp };
}

/**
 * Move a staged temp file into place according to the planned action: "create" uses link(), which fails with
 * EEXIST instead of replacing (no check-then-act window for the destination file itself); "overwrite" does an
 * lstat then rename(), where a swapped destination file is harmless because rename() replaces the link itself.
 * Residual risk: a parent directory swapped to a symlink after stage()'s check is not defended against, since
 * link()/rename() take path strings. Where link() is unsupported (e.g. Windows, some filesystems) create fails
 * with an error; there is no fallback. Returns the status actually achieved.
 */
async function commit(staged, file, action) {
    const { dest, temp } = staged;
    if (action === "create") {
        try {
            await fs.link(temp, dest);
        } catch (error) {
            if (error.code !== "EEXIST") throw error;
            // Something appeared after planning: accept it only if it is a regular file with identical content.
            const stat = await lstatOrNull(dest);
            if (stat?.isFile() && (await fs.readFile(dest, "utf8")) === file.content) return "unchanged";
            throw new Error(`destination already exists with different content (appeared during the write): ${file.relPath}`);
        }
        return "created";
    }
    const stat = await lstatOrNull(dest);
    if (stat === null || !stat.isFile()) {
        throw new Error(`destination changed during the write (symlink, non-file, or removed): ${file.relPath}`);
    }
    await fs.rename(temp, dest);
    return "overwritten";
}

/**
 * Check every file can be persisted, without touching the disk. Throws on the first violation.
 * @param {string} root canonical Git root
 * @param {{ relPath: string, content: string }[]} files
 */
export async function preflightReportFiles(root, files, overwrite) {
    for (const file of files) await plan(root, file, overwrite);
}

/**
 * Persist report files idempotently: preflight all, stage every temp file, then move each into place.
 * Identical existing content is left alone (safe replay); different content needs `overwrite`.
 * If a later move fails, the error names the files already persisted (a rerun resumes idempotently).
 * @returns {Promise<Record<string, "created" | "unchanged" | "overwritten">>} status per relPath
 */
export async function persistReportFiles(root, files, overwrite) {
    const plans = [];
    for (const file of files) plans.push(await plan(root, file, overwrite));
    const staged = new Map();
    const status = {};
    try {
        for (const [i, file] of files.entries()) {
            if (plans[i] !== "unchanged") staged.set(file.relPath, await stage(root, file));
        }
        for (const [i, file] of files.entries()) {
            if (plans[i] === "unchanged") {
                status[file.relPath] = "unchanged";
                continue;
            }
            try {
                status[file.relPath] = await commit(staged.get(file.relPath), file, plans[i]);
            } catch (error) {
                const done = Object.entries(status).map(([p, s]) => `${p} (${s})`);
                const partial = done.length > 0 ? `; already persisted: ${done.join(", ")}` : "";
                throw new Error(`${error.message}${partial}`);
            }
        }
    } finally {
        for (const { temp } of staged.values()) await fs.rm(temp, { force: true });
    }
    return status;
}

/**
 * Replace previously persisted report files with revised content under a compare-and-swap precondition.
 * `previousFiles` and `revisedFiles` must name the same unique set of paths. Each file on disk must be a regular,
 * non-symlink file whose content equals either the previous content (it is replaced) or the revised content
 * (already replaced: a no-op, which makes a resume after a partial commit idempotent). Anything else — missing,
 * externally edited, symlink, non-regular file — throws and nothing external is overwritten. Content is rechecked
 * immediately before each rename, which narrows but does not close the race, and the concurrent-parent-symlink
 * race documented on stage()/commit() remains (path strings, not directory handles). This is not atomic across files:
 * a failure after one file was swapped throws an error whose `persisted` property holds the per-file status so far.
 * @returns {Promise<Record<string, "overwritten" | "unchanged">>} status per relPath
 */
export async function replaceReportFiles(root, previousFiles, revisedFiles) {
    const previous = new Map(previousFiles.map((f) => [f.relPath, f.content]));
    const revised = new Map(revisedFiles.map((f) => [f.relPath, f.content]));
    if (previous.size !== previousFiles.length || revised.size !== revisedFiles.length) {
        throw new Error("duplicate report paths in the replacement");
    }
    if (previous.size !== revised.size || [...previous.keys()].some((p) => !revised.has(p))) {
        throw new Error("previous and revised report path sets differ");
    }

    const readCurrent = async (relPath) => {
        assertContained(root, relPath);
        const { dir, exists } = await walkParents(root, relPath, false);
        const dest = path.join(dir, path.basename(relPath));
        const stat = exists ? await lstatOrNull(dest) : null;
        if (stat === null) throw new Error(`report file is missing: ${relPath}`);
        if (stat.isSymbolicLink()) throw new Error(`refusing symlink destination: ${relPath}`);
        if (!stat.isFile()) throw new Error(`destination exists and is not a regular file: ${relPath}`);
        return fs.readFile(dest, "utf8");
    };
    const classify = async (relPath) => {
        const current = await readCurrent(relPath);
        if (current === revised.get(relPath)) return "unchanged";
        if (current === previous.get(relPath)) return "replace";
        throw new Error(`report file changed outside the workflow; refusing to overwrite it: ${relPath}`);
    };

    const actions = new Map();
    for (const relPath of revised.keys()) actions.set(relPath, await classify(relPath));

    const staged = new Map();
    const status = {};
    try {
        for (const [relPath, action] of actions) {
            if (action === "replace") staged.set(relPath, await stage(root, { relPath, content: revised.get(relPath) }));
        }
        for (const [relPath, action] of actions) {
            if (action === "unchanged") {
                status[relPath] = "unchanged";
                continue;
            }
            try {
                // Recheck right before the swap: only still-previous content may be replaced.
                if ((await classify(relPath)) === "unchanged") {
                    status[relPath] = "unchanged";
                    continue;
                }
                await fs.rename(staged.get(relPath).temp, staged.get(relPath).dest);
                status[relPath] = "overwritten";
            } catch (error) {
                const done = Object.entries(status).map(([p, s]) => `${p} (${s})`);
                const partial = done.length > 0 ? `; already persisted: ${done.join(", ")}` : "";
                throw Object.assign(new Error(`${error.message}${partial}`), { persisted: { ...status } });
            }
        }
    } finally {
        for (const { temp } of staged.values()) await fs.rm(temp, { force: true });
    }
    return status;
}
