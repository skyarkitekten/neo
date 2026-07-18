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

## Install as a plugin

This repo is packaged as a plugin for both harnesses from one tree. Each harness reads its
own manifest, so there's no cross-contamination:

- **Claude Code** reads `.claude-plugin/{plugin,marketplace}.json` → agents from `agents/`
  (Claude subagent format), hooks from `hooks/hooks.json` (`${CLAUDE_PLUGIN_ROOT}`).
- **Copilot CLI** reads `.github/plugin/{plugin,marketplace}.json` (checked before
  `.claude-plugin/`) → agents from `.github/agents/` (`*.agent.md`), hooks from
  `.github/hooks/hooks.json` (v1 schema, `${PLUGIN_ROOT}`).

### Claude Code

```
/plugin marketplace add skyarkitekten/neo
/plugin install neo@neo
```

### GitHub Copilot CLI

```
copilot plugin marketplace add skyarkitekten/neo
copilot plugin install neo@neo
```

Copilot CLI also picks up `.github/agents/` automatically for anyone working **inside**
this repo — no install needed. The plugin path is for using the crew in *other* projects.

`.github/copilot-hooks.template.json` is the older, hand-wired hook example; the plugin now
ships the real config at `.github/hooks/hooks.json`.
