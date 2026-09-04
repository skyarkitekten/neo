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
#   AGENT_RUN_ID   correlation key       (default: current git branch)
#
# NOTE: the jq field paths below are defensive guesses across harnesses.
# Verify them against your harness's real payload once and trim to what's there.

set -o pipefail

EVENT="${1:-unknown}"
LOG_DIR="${AGENT_LOG_DIR:-$HOME/.agent-logs}"
LOG_FILE="$LOG_DIR/events.jsonl"
RUN_ID="${AGENT_RUN_ID:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)}"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

mkdir -p "$LOG_DIR" 2>/dev/null

# Check for jq prerequisite
if ! command -v jq >/dev/null 2>&1; then
  # Warn once per run — the marker is keyed to RUN_ID, so a later run (or a
  # machine where jq is removed again) still gets one warning instead of none.
  WARN_FILE="${LOG_DIR}/.jq-warning-$(printf '%s' "$RUN_ID" | tr -c 'A-Za-z0-9._-' '_')"
  if [ ! -f "$WARN_FILE" ]; then
    touch "$WARN_FILE" 2>/dev/null
    echo "WARNING: jq not found on PATH. Agent logging disabled." >&2
    echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)" >&2
  fi
  # Drain stdin so the harness writing the payload never takes EPIPE/SIGPIPE,
  # then fail open without logging this event.
  cat >/dev/null 2>&1
  printf '{"continue":true}\n'
  exit 0
fi

payload="$(cat)"

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
