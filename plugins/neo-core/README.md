# neo-core

The shipped Neo plugin — a coordinated crew of coding agents for GitHub Copilot CLI that drives
a spec from concept to a draft PR.

## What's inside

- **Agents** (`.github/agents/`, `neo.<role>.agent.md`):
  - `technical-engineer` — the orchestrator. **Start here.** Drives a spec through
    research → plan → implement → review → draft PR.
  - `researcher` — gathers context on the codebase and the task.
  - `implementation-planner` — turns research into an implementation plan.
  - `code-writer` — implements units, one Conventional Commit per unit.
  - `code-reviewer` — reviews the writer's work and requests fixes.
  - `feature-agent`, `task-planner` — the specification crew that turns an issue/story into a
    feature spec and taskset.
- **Skills** (`.github/skills/`):
  - `neo-feature-authoring` — authoring guidance for feature specs.
  - `neo-task-authoring` — authoring guidance for tasksets.
- **Hooks** (`.github/hooks/hooks.json`, v1 schema, `${PLUGIN_ROOT}`):
  - fail-open **observability** logging via `.agent-hooks/log-event.{sh,ps1}`.
  - fail-closed **guardrail** enforcement via `.agent-hooks/enforce-guardrails.{sh,ps1}`
    (blocks commit/push to `main`, draft-PR-only).
- **Tooling**: `scripts/analyze_agent_logs.py` — per-agent and per-run stats from the event log.

## Install

The plugin is packaged for GitHub Copilot CLI. The marketplace is `neo`; the plugin is `neo-core`.

```
copilot plugin marketplace add skyarkitekten/neo
copilot plugin install neo-core@neo
```

Copilot reads `.github/plugin/plugin.json` → agents from `.github/agents/` (`*.agent.md`),
skills from `.github/skills/`, and hooks from `.github/hooks/hooks.json`.

## Use

Invoke the **technical-engineer** with an issue/story reference and it drives the crew to a draft
PR. See the repo docs for detail:

- `docs/concepts/process-flow.md` — the workflow and integration modes.
- `docs/guides/observability.md` — the logging/tuning setup.
- `docs/reference/plugin-contract.md` — the normative folder shape, manifest fields, and naming.

> Copilot is the canonical, sole harness (issue #34). A Claude Code mirror may be regenerated
> from the Copilot source later if there is demand.

## License

MIT
