#!/usr/bin/env bash
# guard-locked-checks.sh <event-name>
# A Copilot CLI `preToolUse` hook that keeps a builder from editing pre-registered checks.
# DRAFT, OPT-IN, NOT REGISTERED in hooks/hooks.json. See docs/contributing/guides/enforcement.md
# § Locked checks and docs/contributing/design/verification-loop.md.
#
# The lock: once the check units for a task are committed, the orchestrator writes a marker
# to the worktree's git dir (never the working tree, so it is never committed):
#
#   "$(git rev-parse --git-path neo-check-lock)"
#   {"lock_sha": "<sha>", "branch": "<branch>", "paths": ["tests/checkout/", "contracts/order.dfy"]}
#
# A path ending in "/" locks everything under that directory; a path with * ? [ is a glob;
# anything else is an exact file. With no marker, or on another branch, the hook allows
# everything, so check authoring before the lock is unaffected.
#
# While the lock is active it denies:
#   1. edit/create/apply_patch tool calls that target a locked path;
#   2. shell commands that look like they write to a locked path (rm, mv, cp, sed -i,
#      redirection, git rm/mv/checkout/restore, Set-Content, ...);
#   3. `git commit` while the index or working tree changes a locked path;
#   4. `git push` while `<lock_sha>..HEAD` changes a locked path;
#   5. any shell command that mentions the marker itself. Lifting or amending the lock is a
#      human decision.
#
# This is a speed bump for a cooperating agent, not a control. Shell pattern matching
# is bypassable. The authoritative checks are Neo Validator's integrity audit
# (`git diff <lock>..<head> -- <locked paths>`) and a CI job that repeats it.
#
# Contract: the same as enforce-guardrails.sh. Read JSON on stdin and print
# {"permissionDecision":"deny",...} to deny or nothing to allow. ALWAYS exit 0. Anything
# unparseable allows with a stderr warning.
#
# Relaxation (a recorded lock amendment, made by a human): NEO_CHECK_LOCK=0, or delete the marker.

set -o pipefail

case "${NEO_CHECK_LOCK:-1}" in
  0|off|OFF|false|FALSE|no|NO) exit 0 ;;
esac

if ! command -v python3 >/dev/null 2>&1; then
  printf 'Neo guard-locked-checks: python3 not found; skipping.\n' >&2
  exit 0
fi

payload="$(cat)"

NEO_HOOK_PAYLOAD="$payload" python3 <<'PY' || printf 'Neo guard-locked-checks: guard crashed; allowing.\n' >&2
import fnmatch, json, os, re, subprocess, sys

def warn(msg):
    sys.stderr.write("Neo guard-locked-checks: %s; allowing.\n" % msg)
    sys.exit(0)

def deny(reason):
    print(json.dumps({"permissionDecision": "deny", "permissionDecisionReason": reason}))
    sys.exit(0)

def git(cwd, *args):
    r = subprocess.run(["git", "-C", cwd, *args], capture_output=True, text=True, timeout=5)
    return r.stdout.strip() if r.returncode == 0 else None

try:
    data = json.loads(os.environ.get("NEO_HOOK_PAYLOAD", ""))
    assert isinstance(data, dict)
except Exception:
    warn("unparseable preToolUse payload")

tool = str(data.get("toolName") or data.get("tool_name") or "")
args = data.get("toolArgs")
if args is None:
    args = data.get("tool_input")
if isinstance(args, str):
    try:
        args = json.loads(args)
    except Exception:
        pass

cwd = data.get("cwd") or os.getcwd()
if not os.path.isdir(cwd):
    sys.exit(0)

try:
    top = git(cwd, "rev-parse", "--show-toplevel")
    marker = git(cwd, "rev-parse", "--git-path", "neo-check-lock")
except Exception:
    sys.exit(0)
if not top or not marker:
    sys.exit(0)
if not os.path.isabs(marker):
    marker = os.path.join(cwd, marker)
if not os.path.isfile(marker):
    sys.exit(0)  # no lock -> nothing to guard

try:
    with open(marker, encoding="utf-8") as f:
        lock = json.load(f)
    paths = [re.sub(r"^\./", "", str(p).replace("\\", "/")) for p in lock.get("paths") or []]
    lock_sha = str(lock.get("lock_sha") or "")
    lock_branch = str(lock.get("branch") or "")
except Exception:
    warn("lock marker %s is unreadable" % marker)

if not paths:
    sys.exit(0)
if lock_branch and git(cwd, "rev-parse", "--abbrev-ref", "HEAD") != lock_branch:
    sys.exit(0)

def rel(p):
    p = str(p).strip().strip("'\"")
    if not p:
        return ""
    ap = p if os.path.isabs(p) else os.path.join(cwd, p)
    r = os.path.relpath(os.path.realpath(ap), os.path.realpath(top)).replace("\\", "/")
    return "" if r.startswith("../") else r

def locked(r):
    if not r:
        return False
    for p in paths:
        if p.endswith("/"):
            if r == p.rstrip("/") or r.startswith(p):
                return True
        elif any(c in p for c in "*?["):
            if fnmatch.fnmatchcase(r, p):
                return True
        elif r == p:
            return True
    return False

def hits(names):
    return sorted({n for n in names if locked(n.replace("\\", "/"))})

REASON = ("Neo check lock: %s is a locked check (pre-registered at %s). The builder must make "
          "locked checks pass, not change them. If the check itself is wrong, stop and escalate "
          "for a human-approved lock amendment (see the neo-evidence-manifest skill).")
lock_ref = lock_sha[:12] or "the lock"

EDIT_TOOLS = {"edit", "create", "write", "str_replace_editor", "str_replace_based_edit_tool",
              "apply_patch", "multi_edit", "multiedit", "notebookedit", "write_file", "edit_file"}
SHELL_TOOLS = {"bash", "powershell", "shell", "run_in_terminal"}

t = tool.lower()
if t in EDIT_TOOLS:
    targets = []
    if isinstance(args, dict):
        for k in ("path", "file_path", "filePath", "target_file", "filename"):
            if isinstance(args.get(k), str):
                targets.append(args[k])
        blob = json.dumps(args)
    else:
        blob = str(args or "")
    # apply_patch-style bodies name their files inline.
    targets += re.findall(r"\*\*\* (?:Add|Update|Delete) File: ([^\n\\]+)", blob)
    targets += re.findall(r"\*\*\* Move to: ([^\n\\]+)", blob)
    bad = sorted({rel(x) for x in targets if locked(rel(x))})
    if bad:
        deny(REASON % (", ".join(bad), lock_ref))
    sys.exit(0)

if t not in SHELL_TOOLS:
    sys.exit(0)

cmd = ""
if isinstance(args, dict):
    for k in ("command", "script", "cmd", "commandLine", "input"):
        if isinstance(args.get(k), str) and args[k]:
            cmd = args[k]
            break
elif isinstance(args, str):
    cmd = args
if not cmd:
    sys.exit(0)
norm = " ".join(cmd.split())

if "neo-check-lock" in norm:
    deny("Neo check lock: the lock marker is human-managed. Agents may not touch it from the "
         "shell. Ask a human to amend or lift the lock.")

if re.search(r"(^|[;&|(\s])git\s+commit\b", norm):
    changed = (git(top, "diff", "--name-only", "HEAD") or "").splitlines()
    changed += (git(top, "diff", "--cached", "--name-only") or "").splitlines()
    bad = hits(changed)
    if bad:
        deny(REASON % (", ".join(bad), lock_ref) +
             " Revert them (they are locked) before committing.")

if re.search(r"(^|[;&|(\s])git\s+push\b", norm) and lock_sha:
    bad = hits((git(top, "diff", "--name-only", lock_sha, "HEAD") or "").splitlines())
    if bad:
        deny(REASON % (", ".join(bad), lock_ref) +
             " Commits since the lock changed them; this branch would carry moved goalposts.")

WRITES = re.compile(
    r"(^|[;&|(\s])(rm|mv|cp|truncate|tee|touch|dd|install|ln|chmod)\s"
    r"|\b(sed|perl|ruby)\s+(-\w*\s+)*-i"
    r"|\bgit\s+(rm|mv|checkout|restore|apply|stash|reset|clean)\b"
    r"|(^|[^0-9&>])>{1,2}\s*[^\s&]"
    r"|\b(Set-Content|Add-Content|Out-File|Remove-Item|Move-Item|Copy-Item|New-Item|Rename-Item|Clear-Content)\b",
    re.IGNORECASE)
if WRITES.search(norm):
    mentioned = []
    for p in paths:
        stem = p.rstrip("/")
        if any(c in stem for c in "*?["):
            stem = re.split(r"[*?\[]", stem, 1)[0].rstrip("/")
        if stem and stem in norm:
            mentioned.append(p)
    if mentioned:
        deny(REASON % (", ".join(sorted(mentioned)), lock_ref) +
             " This command looks like it writes to a locked path.")

sys.exit(0)
PY

exit 0
