# Neo Agentic Development System

A concept-to-spec-to-PR multi-agent coding system for GitHub Copilot (portable to Claude Code).

Initiate a new product platform (greenfield) or an existing codebase (brownfield) by invoking the **business engineer**. The orchestrator drives it through research → plan → implement → review → draft PR.

Initiate a new feature and taskset. Given a GitHub Issue or Azure DevOps story, an orchestrator drives it through
research → plan → implement → review → draft PR.

## Layout

- `AGENTS.md` — project context both harnesses read (layout, commands, style, guardrails).
- `.github/agents/` — the agents: `orchestrator` (start here), `researcher`, `planner`, `code-writer`, `code-reviewer`.
- `.github/copilot-hooks.template.json` — observability logging hooks (verify against your Copilot version).
- `.agent-hooks/log-event.sh` — the logger.
- `scripts/analyze_agent_logs.py` — turns the log into per-agent / per-run stats.
- `docs/` — the manual outline and observability guide.

## Start

Invoke the **orchestrator** with an issue/story reference. See `docs/manual-outline.md`
for the workflow and `docs/observability.md` for the logging/tuning setup.
