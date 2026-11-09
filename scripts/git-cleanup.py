#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""Report (and optionally remove) dead local git branches and worktrees.

EXPERIMENTAL — dev-time only, not ready for distribution. Do not ship in a plugin.
Docs: docs/contributing/guides/git-cleanup.md

Dry run by default. Standard library only, so it runs anywhere Python 3.9+ and git do:

    uv run scripts/git-cleanup.py            # recommended
    python3 scripts/git-cleanup.py           # `py scripts\\git-cleanup.py` on Windows

Branch categories:
  merged    tip is an ancestor of base                            removable
  squashed  changes already in base (squash or rebase merge)      removable
  gone      upstream deleted, changes not found in base           removable with --force
  stale     unmerged, no commits in --stale-days                  report only

Never touched: the base branch, the current branch, the main worktree, the current
worktree, locked worktrees, and branches checked out in a worktree that is kept.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

# commit-tree needs an identity; the probe commit is throwaway, so any identity works.
_PROBE_ENV = {
    **os.environ,
    "GIT_AUTHOR_NAME": "git-cleanup",
    "GIT_AUTHOR_EMAIL": "git-cleanup@localhost",
    "GIT_COMMITTER_NAME": "git-cleanup",
    "GIT_COMMITTER_EMAIL": "git-cleanup@localhost",
}

BOLD = DIM = RED = GRN = YEL = RST = ""


def setup_colors() -> None:
    global BOLD, DIM, RED, GRN, YEL, RST
    # Keep stdout and stderr interleaved; don't crash on commit subjects a legacy console can't encode.
    sys.stdout.reconfigure(line_buffering=True, errors="replace")
    sys.stderr.reconfigure(errors="replace")
    if not sys.stdout.isatty() or os.environ.get("NO_COLOR"):
        return
    if os.name == "nt":
        os.system("")  # turns on ANSI escape handling in the Windows console
    BOLD, DIM, RED, GRN, YEL, RST = (
        "\033[1m", "\033[2m", "\033[31m", "\033[32m", "\033[33m", "\033[0m")


def warn(msg: str) -> None:
    print(f"{YEL}warn:{RST} {msg}", file=sys.stderr)


def die(msg: str) -> None:
    print(f"{RED}error:{RST} {msg}", file=sys.stderr)
    sys.exit(1)


def git(*args: str, cwd: Optional[str] = None, env=None) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=cwd, env=env, capture_output=True,
                          text=True, encoding="utf-8", errors="replace")


def ok(*args: str, cwd: Optional[str] = None) -> bool:
    return git(*args, cwd=cwd).returncode == 0


def out(*args: str, cwd: Optional[str] = None, env=None) -> str:
    p = git(*args, cwd=cwd, env=env)
    if p.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {p.stderr.strip()}")
    return p.stdout.strip()


def same_path(a: str, b: str) -> bool:
    norm = lambda p: os.path.normcase(os.path.realpath(p))
    return norm(a) == norm(b)


def tildify(path: str) -> str:
    try:
        return str(Path("~") / Path(path).relative_to(Path.home()))
    except ValueError:
        return path


@dataclass
class Worktree:
    path: str
    branch: Optional[str] = None
    head: str = ""
    locked: bool = False
    prunable: bool = False


def list_worktrees() -> List[Worktree]:
    trees: List[Worktree] = []
    for line in out("worktree", "list", "--porcelain").splitlines():
        if line.startswith("worktree "):
            trees.append(Worktree(path=line[len("worktree "):]))
        elif not trees:
            continue
        elif line.startswith("HEAD "):
            trees[-1].head = line.split()[1]
        elif line.startswith("branch "):
            trees[-1].branch = line[len("branch "):].removeprefix("refs/heads/")
        elif line.startswith(("locked", "bare")):
            trees[-1].locked = True
        elif line.startswith("prunable"):
            trees[-1].prunable = True
    return trees


def is_dirty(path: str) -> bool:
    return os.path.isdir(path) and bool(git("status", "--porcelain", cwd=path).stdout.strip())


def resolve_base(requested: Optional[str]) -> Tuple[str, str]:
    base = requested
    if not base:
        p = git("symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD")
        base = p.stdout.strip() if p.returncode == 0 else ""
    if not base:
        base = next((c for c in ("origin/main", "origin/master", "main", "master")
                     if ok("rev-parse", "--verify", "--quiet", f"{c}^{{commit}}")), "")
    if not base or not ok("rev-parse", "--verify", "--quiet", f"{base}^{{commit}}"):
        die(f"can't resolve base ref '{base or '<none>'}'; pass --base")
    local = base
    if "/" in base and ok("show-ref", "--verify", "--quiet", f"refs/remotes/{base}"):
        local = base.split("/", 1)[1]
    return base, local


def is_squashed(ref: str, base: str) -> bool:
    """Collapse the branch into one commit on its merge-base and ask `git cherry`
    whether base already holds an equivalent patch (squash or rebase merge)."""
    try:
        mb = out("merge-base", base, ref)
        tree = out("rev-parse", f"{ref}^{{tree}}")
        probe = out("commit-tree", tree, "-p", mb, "-m", "_", env=_PROBE_ENV)
        return out("cherry", base, probe).startswith("-")
    except RuntimeError:
        return False


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="git-cleanup.py",
        description="Report dead local branches and removable worktrees. "
                    "Changes nothing unless --apply. EXPERIMENTAL.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Branch categories:" + __doc__.split("Branch categories:", 1)[1],
    )
    p.add_argument("-a", "--apply", action="store_true",
                   help="remove what the report marks as removable (prompts first)")
    p.add_argument("-y", "--yes", action="store_true", help="don't prompt when applying")
    p.add_argument("-b", "--base", metavar="REF",
                   help="ref to test merges against (default: origin/HEAD, else main)")
    p.add_argument("-s", "--stale-days", type=int, default=30, metavar="N",
                   help="flag unmerged branches with no commits in N days (default: 30)")
    p.add_argument("-f", "--force", action="store_true",
                   help='also delete "gone" branches whose changes aren\'t in base, and remove '
                        "dirty worktrees (DISCARDS uncommitted changes)")
    p.add_argument("--detached", action="store_true",
                   help="also remove clean detached-HEAD worktrees whose HEAD is in base")
    p.add_argument("--no-fetch", action="store_true", help="skip `git fetch --prune`")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    setup_colors()

    if not ok("rev-parse", "--git-dir"):
        die("not inside a git repository")
    if not args.no_fetch and not ok("fetch", "--all", "--prune", "--quiet"):
        warn("git fetch --prune failed; using local refs")

    base, base_local = resolve_base(args.base)
    cur = git("symbolic-ref", "--quiet", "--short", "HEAD")
    current_branch = cur.stdout.strip() if cur.returncode == 0 else ""
    current_wt = out("rev-parse", "--show-toplevel")
    worktrees = list_worktrees()
    main_wt = worktrees[0].path if worktrees else current_wt
    stale_cutoff = time.time() - args.stale_days * 86400

    rm_branches: List[Tuple[str, str, str, str]] = []  # name, category, age, subject
    rm_worktrees: List[Tuple[str, str, bool]] = []     # path, reason, dirty
    keep: List[Tuple[str, str, str, str]] = []         # category, name, age, note

    def blocker(wt: Worktree) -> Optional[str]:
        if same_path(wt.path, main_wt):
            return "main worktree"
        if same_path(wt.path, current_wt):
            return "current worktree"
        if wt.locked:
            return "worktree locked"
        if not args.force and is_dirty(wt.path):
            return "worktree dirty"
        return None

    refs = out("for-each-ref", "refs/heads", "--format="
               "%(refname)%09%(committerdate:unix)%09%(committerdate:relative)%09%(upstream:track)")
    for line in refs.splitlines():
        ref, ts, age, track = (line.split("\t") + [""] * 4)[:4]
        name = ref[len("refs/heads/"):]
        if name in (base_local, current_branch):
            continue

        if ok("merge-base", "--is-ancestor", ref, base):
            cat = "merged"
        elif is_squashed(ref, base):
            cat = "squashed"
        elif track == "[gone]":
            cat = "gone"
        elif int(ts or 0) < stale_cutoff:
            cat = "stale"
        else:
            continue

        if cat == "stale" or (cat == "gone" and not args.force):
            note = "unmerged work; --force to delete" if cat == "gone" else "review manually"
            keep.append((cat, name, age, note))
            continue

        wt = next((w for w in worktrees if w.branch == name), None)
        if wt and not wt.prunable:  # prunable records are cleared by `git worktree prune`
            why = blocker(wt)
            if why:
                keep.append((cat, name, age, f"{why}: {tildify(wt.path)}"))
                continue
            dirty = is_dirty(wt.path)
            rm_worktrees.append((wt.path, f"branch {name} is {cat}" + (", DIRTY" if dirty else ""), dirty))
        subject = out("log", "-1", "--format=%s", ref)
        rm_branches.append((name, cat, age, subject))

    for wt in worktrees:
        if wt.branch or wt.prunable or blocker(wt):
            continue
        if is_dirty(wt.path):
            keep.append(("detached", "-", "-", f"dirty detached worktree: {tildify(wt.path)}"))
        elif ok("merge-base", "--is-ancestor", wt.head, base):
            if args.detached:
                rm_worktrees.append((wt.path, f"detached at {wt.head[:7]}, already in {base}", False))
            else:
                keep.append(("detached", "-", "-",
                             f"clean, in {base} (--detached to remove): {tildify(wt.path)}"))

    prunable = sum(1 for w in worktrees if w.prunable)

    # ---------- report ----------
    print(f"{BOLD}Base:{RST} {base}   {BOLD}Current:{RST} {current_branch or '(detached)'}   "
          f"{DIM}stale > {args.stale_days}d{RST}\n")

    print(f"{BOLD}{RED}Removable branches ({len(rm_branches)}){RST}")
    for name, cat, age, subject in rm_branches:
        print(f"  {cat:<9} {name:<45} {age:<16} {DIM}{subject[:60]}{RST}")
    if not rm_branches:
        print(f"  {DIM}none{RST}")
    print()

    print(f"{BOLD}{RED}Removable worktrees ({len(rm_worktrees)}){RST}")
    for path, reason, _ in rm_worktrees:
        print(f"  {tildify(path):<70} {DIM}{reason}{RST}")
    if not rm_worktrees:
        print(f"  {DIM}none{RST}")
    if prunable:
        print(f"  + {prunable} stale worktree record(s) with missing directories (git worktree prune)")
    print()

    print(f"{BOLD}{YEL}Needs a look ({len(keep)}){RST}")
    for cat, name, age, note in sorted(keep):
        print(f"  {cat:<9} {name:<45} {age:<16} {DIM}{note}{RST}")
    if not keep:
        print(f"  {DIM}none{RST}")
    print()

    if not args.apply:
        print(f"{DIM}Dry run. Re-run with --apply to remove the items above marked removable.{RST}")
        return 0
    if not (rm_branches or rm_worktrees or prunable):
        print(f"{GRN}Nothing to remove.{RST}")
        return 0

    if not args.yes:
        if not sys.stdin.isatty():
            die("refusing to prompt without a terminal; pass --yes")
        reply = input(f"Remove {len(rm_branches)} branch(es) and {len(rm_worktrees)} worktree(s)? [y/N] ")
        if reply.strip().lower() not in ("y", "yes"):
            print("Aborted.")
            return 1

    failures = 0
    if prunable:
        p = git("worktree", "prune", "--verbose")
        print(p.stdout + p.stderr, end="")

    for path, _, dirty in rm_worktrees:
        p = git("worktree", "remove", *(["--force"] if dirty else []), path)
        if p.returncode == 0:
            print(f"{GRN}removed worktree{RST} {tildify(path)}")
        else:
            failures += 1
            warn(f"couldn't remove worktree {path}: {p.stderr.strip()}")

    for name, *_ in rm_branches:
        p = git("branch", "-D", "--quiet", name)
        if p.returncode == 0:
            print(f"{GRN}deleted branch{RST} {name}")
        else:
            failures += 1
            warn(f"couldn't delete {name}: {p.stderr.strip()}")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
