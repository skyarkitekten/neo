#!/usr/bin/env bash
# enforce-guardrails.sh <event-name>
# A Copilot CLI `preToolUse` enforcement hook. Blocks the two AGENTS.md guardrails
# that must hold at the harness level, not merely in a prompt:
#
#   Rule A — never commit or push to `main` (or `master`).
#   Rule B — agents open DRAFT pull requests only.
#
# Contract (verified against GitHub's Copilot hooks reference):
#   * Input: JSON on stdin — { sessionId, timestamp, cwd, toolName, toolArgs }.
#   * Output: a single JSON object on stdout describing the decision:
#       {"permissionDecision":"deny","permissionDecisionReason":"..."}   -> block
#       (empty stdout)                                                    -> allow
#     `permissionDecisionReason` is REQUIRED on deny.
#   * Command preToolUse hooks are FAIL-CLOSED on error: any crash or non-zero exit
#     (including exit 2) denies the call regardless of stdout. So we always `exit 0`
#     and express the verdict purely through the JSON. Timeouts, by contrast, always
#     fail OPEN — keep this hook fast and dependency-light.
#
# Deliberate failure behavior (issue #42): this hook is decisive for the operations
# it understands, but if the payload can't be parsed at all (malformed JSON, or no
# python3 on PATH) it ALLOWS with a stderr warning rather than denying every tool
# call and bricking the session. Server-side branch protection is the real backstop.
#
# Relaxation: set NEO_ENFORCE_GUARDRAILS=0 (or "off"/"false") to disable. Other
# levers live at the harness layer (disableAllHooks, settings.local.json,
# --config-dir, prompt-mode GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS) — see
# docs/enforcement.md.

set -o pipefail

allow() { exit 0; }  # empty stdout == allow

deny() {
  # $1 = human-readable reason (shown to the agent)
  python3 - "$1" <<'PY' 2>/dev/null || printf '{"permissionDecision":"deny","permissionDecisionReason":"blocked by neo guardrail"}\n'
import json, sys
print(json.dumps({"permissionDecision": "deny", "permissionDecisionReason": sys.argv[1]}))
PY
  exit 0
}

# Escape hatch: intentionally relax enforcement.
case "${NEO_ENFORCE_GUARDRAILS:-1}" in
  0|off|OFF|false|FALSE|no|NO) allow ;;
esac

payload="$(cat)"

# Need python3 to parse JSON reliably. If it's missing we cannot evaluate the
# command safely, so fail OPEN with a warning (see deliberate failure behavior).
if ! command -v python3 >/dev/null 2>&1; then
  printf 'neo enforce-guardrails: python3 not found; skipping enforcement.\n' >&2
  allow
fi

# Extract tool name and the shell command text (for bash/powershell tools) as two
# NUL-free lines. On any parse failure, emit nothing so we fall through to allow.
# The payload is passed via an env var (not stdin) because the heredoc below already
# occupies python3's stdin as the program source.
parsed="$(NEO_HOOK_PAYLOAD="$payload" python3 <<'PY' 2>/dev/null
import json, os, sys

try:
    data = json.loads(os.environ.get("NEO_HOOK_PAYLOAD", ""))
except Exception:
    sys.exit(0)

if not isinstance(data, dict):
    sys.exit(0)

# camelCase (preToolUse) and VS Code / PascalCase (PreToolUse) shapes.
tool = data.get("toolName") or data.get("tool_name") or ""
args = data.get("toolArgs")
if args is None:
    args = data.get("tool_input")

cmd = ""
if isinstance(args, dict):
    for k in ("command", "script", "cmd", "commandLine", "input"):
        v = args.get(k)
        if isinstance(v, str) and v:
            cmd = v
            break
    else:
        # Fall back to the whole arg object so patterns can still be matched.
        cmd = json.dumps(args)
elif isinstance(args, str):
    cmd = args

cwd = data.get("cwd") or ""

# Collapse to single lines; the reader below splits line by line.
print(str(tool).replace("\n", " "))
print(cmd.replace("\r", " ").replace("\n", " "))
print(str(cwd).replace("\n", " "))
PY
)"

# python3 produced nothing -> unparseable payload -> fail open with a warning.
if [ -z "$parsed" ]; then
  printf 'neo enforce-guardrails: unparseable preToolUse payload; allowing.\n' >&2
  allow
fi

tool="$(printf '%s' "$parsed" | sed -n '1p')"
cmd="$(printf '%s' "$parsed" | sed -n '2p')"
cwd="$(printf '%s' "$parsed" | sed -n '3p')"

# Only shell tools carry commands we enforce against. Everything else runs freely.
case "$tool" in
  bash|powershell|Bash|shell|run_in_terminal) ;;
  *) allow ;;
esac

# Nothing to inspect.
[ -z "$cmd" ] && allow

# Normalize whitespace for matching.
norm="$(printf '%s' "$cmd" | tr -s '[:space:]' ' ')"

# ---------------------------------------------------------------------------
# Rule B — draft-PR-only.
# ---------------------------------------------------------------------------
if printf '%s' "$norm" | grep -Eq '(^|[;&|[:space:]])gh[[:space:]]+pr[[:space:]]+create([[:space:]]|$)'; then
  if ! printf '%s' "$norm" | grep -Eq '(^|[[:space:]])(--draft|-d)([[:space:]=]|$)'; then
    deny "Neo guardrail: agents open DRAFT pull requests only. Re-run 'gh pr create' with --draft. To override intentionally, set NEO_ENFORCE_GUARDRAILS=0."
  fi
fi

if printf '%s' "$norm" | grep -Eq '(^|[;&|[:space:]])gh[[:space:]]+pr[[:space:]]+ready([[:space:]]|$)'; then
  deny "Neo guardrail: agents must not mark a PR ready for review ('gh pr ready'); leave it a draft for a human. Override with NEO_ENFORCE_GUARDRAILS=0."
fi

# ---------------------------------------------------------------------------
# Rule A — never commit or push to main/master.
# ---------------------------------------------------------------------------

# A1: explicit push refspec targeting main/master from ANY branch, e.g.
#     git push origin main | git push origin HEAD:main | git push origin :master
if printf '%s' "$norm" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+push\b'; then
  if printf '%s' "$norm" | grep -Eq '(^|[[:space:]:])(main|master)([[:space:]]|$)'; then
    deny "Neo guardrail: pushing to 'main'/'master' is blocked. Push your feature branch instead and open a draft PR. Override with NEO_ENFORCE_GUARDRAILS=0."
  fi
fi

# A2: commit or bare push while HEAD is on main/master.
if printf '%s' "$norm" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+(commit|push)\b'; then
  if [ -n "$cwd" ] && [ -d "$cwd" ]; then
    branch="$(git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null)"
  else
    branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
  fi
  case "$branch" in
    main|master)
      deny "Neo guardrail: you are on '$branch'; committing or pushing to it is blocked. Create a feature branch first. Override with NEO_ENFORCE_GUARDRAILS=0."
      ;;
  esac
fi

allow
