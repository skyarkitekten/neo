# neo observability logging

Records what each agent does into a JSONL log so you can tune the `.agent.md` prompts from data, not guesses. Logging is fail-open and append-only — it never blocks or slows a turn.

> This page covers the **fail-open observability** hook set. For the **fail-closed
> `preToolUse` enforcement** hooks (block commit/push to `main`, draft-PR-only), see
> [enforcement.md](enforcement.md). Both are wired from the same `.github/hooks/hooks.json`.

## Files

- `.agent-hooks/log-event.sh` — the logger (bash/macOS/Linux). One record per lifecycle event. Needs `jq`.
- `.agent-hooks/log-event.ps1` — the Windows/PowerShell sibling. Same record shape, native PowerShell JSON, **no `jq` dependency**.
- `.github/hooks/hooks.json` — GitHub Copilot CLI hook config (v1 schema; shipped in `plugins/neo-core/`, verify against your version). Each entry wires **both** a `bash` and a `powershell` command; Copilot runs the one matching the OS.
- `analyze_agent_logs.py` — turns the log into per-agent and per-run stats. Reads the log from either sibling identically.

## Install

1. Copy **both** loggers into your repo:
   - `.agent-hooks/log-event.sh` — `chmod +x` it; requires `jq` on PATH (macOS: `brew install jq`).
   - `.agent-hooks/log-event.ps1` — no external dependency (uses built-in PowerShell JSON).
2. **Copilot:** merge `plugins/neo-core/.github/hooks/hooks.json` into your Copilot CLI hook settings. Each event carries both a `bash` and a `powershell` command, so Windows uses the `.ps1` and macOS/Linux use the `.sh` automatically. Confirm the file location, key names, and event names against your installed Copilot version first — these vary.

## What gets logged

Each line: `ts`, `run` (correlation id — defaults to git branch), `event`, `agent`, `tool`, `status`, and a truncated `prompt`. Default log path is `~/.agent-logs/events.jsonl` (override with `AGENT_LOG_DIR`).

Set `AGENT_RUN_ID` to correlate all events for one spec/task; otherwise the current git branch is used, which works well with the feature-branch-per-spec flow.

## Analyze

```bash
python3 analyze_agent_logs.py                 # ~/.agent-logs/events.jsonl
python3 analyze_agent_logs.py path/to.jsonl   # explicit path
python3 analyze_agent_logs.py path --run feat/42-login
python3 analyze_agent_logs.py path --json     # machine-readable
```

Reports event/tool counts and approximate active time per agent, and per run the wall-clock duration, worker completions, and review→fix rounds. More than one review round on a run is flagged — that's your signal to tighten the writer prompt or the acceptance criteria.

## Verify before trusting the fields

Both loggers read the same fields via ordered fallbacks. These have been reconciled against Copilot's observed event vocabulary (camelCase — `toolName`, `sessionId`, boolean `success`, `content`), with the older snake_case names kept as fallbacks for other harnesses:

- **`tool`** ← `tool_name` / `toolName` / `tool`
- **`session`** ← `session_id` / `sessionId`
- **`status`** ← `status` / `result_status` / boolean `success` (→ `ok`/`error`) / presence of `error`
- **`prompt`** ← `prompt` / `user_prompt` / `content` / `message` / `input`
- **`agent`** ← `agent_name` / `agentName` / `agent` — **not yet confirmed against a real payload.** Copilot's event stream doesn't expose an obvious agent name at the top level, so `agent` may come back null until you confirm the real field. The analyzer warns when most records are unattributed.

The hook stdin payload can still differ from these guesses. Run one real session, look at `events.jsonl`, and trim the fallbacks to what your harness actually emits. **Update both siblings together** so Windows and macOS/Linux stay in sync.
