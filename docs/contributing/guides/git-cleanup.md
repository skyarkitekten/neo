# Cleaning up dead branches and worktrees

> [!WARNING]
> **Experimental — not ready for distribution.** `scripts/git-cleanup.py` is a dev-time
> convenience for people working on Neo. It is not part of any plugin, is not covered by CI,
> and its flags, categories, and output may change without notice. Do not copy it into
> `plugins/*/` or recommend it to consuming repos. Always read the dry-run report before you
> pass `--apply`.

Neo work happens on short-lived feature branches, often in Copilot app worktrees. After the
PRs merge, the local branches and worktrees stay behind. `scripts/git-cleanup.py` lists the
ones that are safe to remove and, if you ask it to, removes them.

## Quick start

From the repo root:

```bash
uv run scripts/git-cleanup.py                  # report only — changes nothing
uv run scripts/git-cleanup.py --apply          # prompts once, then removes what's marked removable
uv run scripts/git-cleanup.py --apply --yes    # no prompt
```

The script acts on whichever repo your shell is in, so you can point it at another checkout:
`cd ../other-repo && uv run /path/to/neo/scripts/git-cleanup.py`.

### Running it: `uv` recommended

Neo's scripts are Python so they behave the same on macOS, Linux, and Windows. This one uses
only the standard library and needs Python 3.9+ and `git` on `PATH`.

Neo power users should run scripts with [`uv`](https://docs.astral.sh/uv/). The script carries
[PEP 723](https://peps.python.org/pep-0723/) inline metadata, so `uv run` picks a matching
interpreter (downloading one if needed) in an isolated environment. No virtualenv, no
`pip install`, and no dependence on whatever `python3` your `PATH` resolves to.

Without `uv`, call the interpreter directly:

```bash
python3 scripts/git-cleanup.py          # macOS / Linux
py scripts\git-cleanup.py               # Windows
```

## What it reports

The script first runs `git fetch --all --prune` so upstream-deleted branches show as `gone`.
Then it compares every local branch against the **base** ref. The base is `origin/HEAD`,
falling back to `origin/main`, `origin/master`, `main`, then `master`.

| Category | Meaning | Removed by `--apply`? |
| --- | --- | --- |
| `merged` | The branch tip is an ancestor of base. | Yes |
| `squashed` | The branch's net change already exists in base (squash or rebase merge). | Yes |
| `gone` | The upstream was deleted, but the changes aren't found in base. | Only with `--force` |
| `stale` | Unmerged, with no commits in `--stale-days` (default 30). | Never — report only |

The report has three sections:

- **Removable branches** — what `--apply` deletes (with `git branch -D`).
- **Removable worktrees** — worktrees whose branch is being deleted, plus records for
  worktree directories that no longer exist (cleared with `git worktree prune`).
- **Needs a look** — dead branches the script won't remove, and why: unmerged work, a dirty
  worktree, a locked worktree, or a detached worktree.

### How squash detection works

The script builds a throwaway commit containing the branch's whole tree, parented on its
merge-base with base. It then asks `git cherry` whether base already has an equivalent patch.
This catches branches that GitHub merged with "Squash and merge" or "Rebase and merge," which a
plain ancestor check misses. A branch that was squash-merged and then received more commits
will not match. It lands in `gone` or `stale` instead.

## Options

| Flag | Effect |
| --- | --- |
| `-a`, `--apply` | Remove everything marked removable. Prompts unless `--yes`. Without a terminal (CI, piped input), it refuses to run unless you also pass `--yes`. |
| `-y`, `--yes` | Skip the confirmation prompt. |
| `-b`, `--base <ref>` | Compare against `<ref>` instead of the auto-detected base. |
| `-s`, `--stale-days <n>` | Age threshold for `stale` (default 30). |
| `-f`, `--force` | Also delete `gone` branches and remove **dirty** worktrees. **Discards uncommitted changes and unmerged commits.** |
| `--detached` | Also remove clean detached-HEAD worktrees whose `HEAD` is already in base. |
| `--no-fetch` | Skip `git fetch --prune`; use local refs as they are. |
| `-h`, `--help` | Print usage. |

## What it never touches

- The base branch and the branch you're on.
- The main checkout and the worktree you're running from.
- Locked worktrees (`git worktree lock`).
- Dirty worktrees, and any branch checked out in one, unless you pass `--force`.
- Remote branches. The script deletes only local refs and local worktree directories.

## Copilot app worktrees

The Copilot app keeps a pre-warmed worktree on a detached `HEAD`
(`copilot-worktrees/<repo>/copilot-prewarm-*`). It looks like a removable detached worktree,
so the script lists it under **Needs a look** and leaves it alone. Pass `--detached` only if you
know the app isn't using it. Removing a worktree that backs a live app session breaks that
session. Archive the session in the app instead.

## Known limitations

- **Not tested in CI.** It was exercised by hand against this repo and a scratch repo, on macOS
  with Python 3.9 and 3.12.
- **Windows is untested.** It is written to be portable (standard library only, no shell-outs
  besides `git`), but nobody has run it on Windows yet.
- **One base only.** Branches merged into a release branch other than base aren't recognized.
- **Local view only.** It doesn't check open PRs. A `gone` branch might still back a PR on a
  fork. Check before you `--force`.
- **No undo.** Deleted branches are recoverable only through `git reflog` until it expires.
  Removed dirty worktrees are not recoverable.
