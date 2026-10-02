#!/usr/bin/env python3
"""Bump plugin SemVer from Conventional Commits.

Usage: bump-versions.py <base-rev> <head-rev>

For each plugins/<name>/, reads the non-merge commits in base..head that touched
that directory (skipping `chore(release)` commits) and bumps the plugin's
plugin.json and its plugins[] entry in .github/plugin/marketplace.json;
the marketplace's own metadata.version is bumped by the highest level applied:
  `type!:` or a `BREAKING CHANGE` footer -> major, `feat` -> minor, anything else -> patch.
Prints one `<plugin> <old> -> <new>` line per bump; prints nothing if none.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MARKETPLACE = ROOT / ".github/plugin/marketplace.json"
HEADER = re.compile(r"^(\w+)(\([^)]*\))?(!)?:")
SEP = "\x1e"


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True, text=True).stdout


def level(base, head, plugin_dir):
    out = git("log", "--no-merges", f"--format=%B{SEP}", f"{base}..{head}", "--", plugin_dir)
    rank = 0  # 0 none, 1 patch, 2 minor, 3 major
    for msg in filter(None, (m.strip() for m in out.split(SEP))):
        m = HEADER.match(msg)
        if m and m.group(1) == "chore" and m.group(2) == "(release)":
            continue
        if (m and m.group(3)) or re.search(r"^BREAKING[ -]CHANGE:", msg, re.M):
            rank = max(rank, 3)
        elif m and m.group(1) == "feat":
            rank = max(rank, 2)
        else:
            rank = max(rank, 1)
    return rank


def bump(version, rank):
    major, minor, patch = (int(p) for p in version.split("."))
    if rank == 3:
        return f"{major + 1}.0.0"
    if rank == 2:
        return f"{major}.{minor + 1}.0"
    return f"{major}.{minor}.{patch + 1}"


def write(path, data):
    path.write_text(json.dumps(data, indent=2) + "\n")


def main():
    base, head = sys.argv[1:3]
    if set(base) == {"0"}:  # new branch / first push: nothing to diff against
        return
    market = json.loads(MARKETPLACE.read_text())
    changed = False
    top = 0
    for entry in market["plugins"]:
        plugin_dir = entry["source"]
        rank = level(base, head, plugin_dir)
        if not rank:
            continue
        top = max(top, rank)
        manifest = ROOT / plugin_dir / "plugin.json"
        data = json.loads(manifest.read_text())
        old, new = data["version"], bump(data["version"], rank)
        data["version"] = entry["version"] = new
        write(manifest, data)
        changed = True
        print(f"{entry['name']} {old} -> {new}")
    if changed:
        meta = market["metadata"]
        old, meta["version"] = meta["version"], bump(meta["version"], top)
        write(MARKETPLACE, market)
        print(f"{market['name']} (marketplace) {old} -> {meta['version']}")


if __name__ == "__main__":
    main()
