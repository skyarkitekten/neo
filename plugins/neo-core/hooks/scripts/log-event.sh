#!/usr/bin/env bash
# log-event.sh <event-name>
# Appends one JSONL record per agent lifecycle event.
# Design: fast, append-only, fail-open — logging must never block or slow a turn.
#
# Reads the event payload as JSON on stdin (both Copilot and Claude Code pass
# JSON this way) and writes a compact record to $AGENT_LOG_DIR/events.jsonl.
#
# REQUIRES: jq (https://jqlang.github.io/jq/). On macOS, install with: brew install jq
#
# Env:
#   AGENT_LOG_DIR  where to write logs   (default: $HOME/.agent-logs)
#   AGENT_RUN_ID   correlation key       (default: see "run" fallback below)
#
# The "run" field falls back in order: AGENT_RUN_ID -> git branch of the
# payload's cwd -> git branch of the hook's own cwd -> payload session id ->
# "unknown". Hooks often execute outside the repo, so the payload cwd matters.
#
# NOTE: the jq field paths below are defensive guesses across harnesses.
# Verify them against your harness's real payload once and trim to what's there.

set -o pipefail

EVENT="${1:-unknown}"
LOG_DIR="${AGENT_LOG_DIR:-$HOME/.agent-logs}"
LOG_FILE="$LOG_DIR/events.jsonl"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

mkdir -p "$LOG_DIR" 2>/dev/null

payload="$(cat)"

# Branch name for a directory, or empty. A detached HEAD reports "HEAD", which
# is not a useful correlation key, so it is treated as no branch.
git_branch() {
  local b
  if [ -n "$1" ]; then
    b="$(git -C "$1" rev-parse --abbrev-ref HEAD 2>/dev/null)"
  else
    b="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
  fi
  [ "$b" = "HEAD" ] && b=""
  printf '%s' "$b"
}

HAVE_JQ=1
command -v jq >/dev/null 2>&1 || HAVE_JQ=0

PAYLOAD_CWD=""
PAYLOAD_SESSION=""
if [ "$HAVE_JQ" = 1 ]; then
  PAYLOAD_CWD="$(printf '%s' "$payload" | jq -r '(.cwd // .workingDirectory // .working_directory // empty) | strings' 2>/dev/null | head -n 1)"
  PAYLOAD_SESSION="$(printf '%s' "$payload" | jq -r '(.session_id // .sessionId // empty) | tostring' 2>/dev/null | head -n 1)"
fi

RUN_ID="${AGENT_RUN_ID:-}"
[ -z "$RUN_ID" ] && [ -n "$PAYLOAD_CWD" ] && [ -d "$PAYLOAD_CWD" ] && RUN_ID="$(git_branch "$PAYLOAD_CWD")"
[ -z "$RUN_ID" ] && RUN_ID="$(git_branch "")"
[ -z "$RUN_ID" ] && RUN_ID="$PAYLOAD_SESSION"
[ -z "$RUN_ID" ] && RUN_ID="unknown"

# Check for jq prerequisite
if [ "$HAVE_JQ" = 0 ]; then
  # Warn once per run — the marker is keyed to RUN_ID, so a later run (or a
  # machine where jq is removed again) still gets one warning instead of none.
  WARN_FILE="${LOG_DIR}/.jq-warning-$(printf '%s' "$RUN_ID" | tr -c 'A-Za-z0-9._-' '_')"
  if [ ! -f "$WARN_FILE" ]; then
    touch "$WARN_FILE" 2>/dev/null
    echo "WARNING: jq not found on PATH. Agent logging disabled." >&2
    echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)" >&2
  fi
  # stdin was already drained above, so the harness never takes EPIPE/SIGPIPE;
  # fail open without logging this event.
  printf '{"continue":true}\n'
  exit 0
fi

# De-duplicate across plugins. neo-core and neo-product each register this
# logger, so with both installed Copilot fires it twice per event with the
# same payload. The first invocation atomically claims the event — keyed on
# hook event + sessionId + the payload's millisecond timestamp — and the
# second sees the claim and skips. Payloads without both ids are always
# logged, and if the claim can't be written we log anyway: a duplicate beats
# a dropped event. Claim dirs idle for over a day are pruned at sessionStart.
claim_ids="$(printf '%s' "$payload" | jq -r \
  '[(.sessionId // .session_id // ""), ((.timestamp // "") | tostring)] | @tsv' 2>/dev/null)"
claim_sid="$(printf '%s' "${claim_ids%%	*}" | tr -c 'A-Za-z0-9._-' '_')"
claim_ts="$(printf '%s' "${claim_ids#*	}" | tr -c 'A-Za-z0-9._-' '_')"
CLAIM_ROOT="$LOG_DIR/.claims"
if [ "$EVENT" = "sessionStart" ] && [ -d "$CLAIM_ROOT" ]; then
  find "$CLAIM_ROOT" -mindepth 1 -maxdepth 1 -type d -mmin +1440 -exec rm -rf {} + 2>/dev/null
fi
if [ -n "$claim_sid" ] && [ -n "$claim_ts" ]; then
  claim_dir="$CLAIM_ROOT/$claim_sid"
  claim="$claim_dir/$(printf '%s' "$EVENT" | tr -c 'A-Za-z0-9._-' '_').$claim_ts"
  mkdir -p "$claim_dir" 2>/dev/null
  if ! (set -C; : > "$claim") 2>/dev/null && [ -e "$claim" ]; then
    printf '{"continue":true}\n'
    exit 0
  fi
fi

# Curated record with cross-harness fallbacks. Strings are truncated so tool
# results and prompts don't bloat the log.
record="$(printf '%s' "$payload" | jq -c \
  --arg ts "$TS" --arg run "$RUN_ID" --arg event "$EVENT" '
  {
    ts:     $ts,
    run:    $run,
    event:  $event,
    agent:  (.agent_name // .agentName // .agent // null),
    tool:   (.tool_name  // .toolName  // .tool  // null),
    status: ((.status // .result_status
              // (if (.success // null) != null then (if .success then "ok" else "error" end) else null end)
              // (if (.error // null) != null then "error" else null end)) // null),
    session:(.session_id // .sessionId // null),
    prompt: ((.prompt // .user_prompt // .content // .message // .input // null) | if type=="string" then .[0:500] else . end)
  }' 2>/dev/null)"

# If the payload shape was unexpected and jq produced nothing, keep a minimal
# raw record so no event is silently dropped. jq is on PATH by this point, but
# this call can still fail (e.g. non-UTF-8 payload), so the append is guarded.
if [ -z "$record" ]; then
  record="$(jq -nc --arg ts "$TS" --arg run "$RUN_ID" --arg event "$EVENT" \
    --arg raw "$(printf '%s' "$payload" | head -c 2000)" \
    '{ts:$ts, run:$run, event:$event, parse_error:true, raw:$raw}' 2>/dev/null)"
fi

# Never append an empty line — a blank record breaks every downstream reader.
if [ -n "$record" ]; then
  printf '%s\n' "$record" >> "$LOG_FILE"
fi

# Emit the explicit continue signal so a logging hook never stalls a turn.
# (Empty stdout also means "continue", but being explicit matches the contract.)
printf '{"continue":true}\n'
exit 0
