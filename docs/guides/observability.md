# neo observability logging

Records what each agent does into a JSONL log so you can tune the `.agent.md` prompts from data, not guesses. Logging is fail-open and append-only — it never blocks or slows a turn.

## Files

- `.agent-hooks/log-event.sh` — the logger. One record per lifecycle event.
- `.github/hooks/hooks.json` — GitHub Copilot CLI hook config (v1 schema; shipped in `plugins/neo-core/`, verify against your version).
- `analyze_agent_logs.py` — turns the log into per-agent and per-run stats.

## Install

1. Copy `.agent-hooks/log-event.sh` into your repo and make it executable:
   `chmod +x .agent-hooks/log-event.sh`
2. Requires `jq` on PATH.
3. **Copilot:** merge `plugins/neo-core/.github/hooks/hooks.json` into your Copilot CLI hook settings. Confirm the file location, key names, and event names against your installed Copilot version first — these vary.

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

The `jq` paths in `log-event.sh` (`agent_name`, `tool_name`, etc.) are defensive guesses at Copilot's event shape. Run one real session, look at `events.jsonl`, and trim the paths to what your harness actually emits. If `agent` is mostly null, the analyzer will warn you and agent-level stats won't be meaningful until attribution is fixed.
