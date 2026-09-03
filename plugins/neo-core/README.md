# neo-core

The shipped Neo plugin for the coding and specification loops — a coordinated crew of coding
agents for GitHub Copilot CLI that drives a spec from concept to a draft PR.

## What's inside

- **Agents** (`agents/`, `neo.<role>.agent.md`):
  - `business-engineer` — the Specification loop orchestrator. Segments a PRD, runs
    `feature-agent` and `task-planner` for each segment, files the approved tasks, then spawns one
    session per task running `technical-engineer`. Needs the Copilot desktop app.
  - `technical-engineer` — the coding orchestrator. **Start here for a single task.** Drives a spec
    through research → plan → implement → review → draft PR.
  - `researcher` — gathers context on the codebase and the task.
  - `implementation-planner` — turns research into an implementation plan.
  - `code-writer` — implements units, one Conventional Commit per unit.
  - `code-reviewer` — reviews the writer's work and requests fixes.
  - `feature-agent`, `task-planner` — the specification crew that turns an issue/story into a
    feature spec and taskset.
- **Skills** (`skills/`):
  - `neo-evidence-standard` — the retrieval-or-silence rule and the `FACT`/`INFERENCE`/`RECALL` labels.
  - `neo-feature-authoring` — authoring guidance for feature specs.
  - `neo-task-authoring` — authoring guidance for tasksets.
- **Hooks** (`hooks/hooks.json`, v1 schema, `${PLUGIN_ROOT}`):
  - fail-open **observability** logging via `hooks/scripts/log-event.{sh,ps1}` — the only
    thing the manifest registers.
  - opt-in **guardrail** enforcement via `hooks/scripts/enforce-guardrails.{sh,ps1}`
    (blocks commit/push to `main`, draft-PR-only). Shipped **unregistered**: it is a
    fail-closed `preToolUse` hook, so any failure to launch denies every tool call, and the
    policy is the consuming repo's to choose. See
    [enforcement.md](https://github.com/skyarkitekten/neo/blob/main/docs/contributing/guides/enforcement.md)
    to opt in.
- **Tooling**: `scripts/analyze_agent_logs.py` — per-agent and per-run stats from the event log.

## Install

The plugin is packaged for GitHub Copilot CLI. The marketplace is `neo`; the plugin is `neo-core`.

```
copilot plugin marketplace add skyarkitekten/neo
copilot plugin install neo-core@neo
```

Copilot reads `plugin.json` → agents from `agents/` (`*.agent.md`),
skills from `skills/`, and hooks from `hooks/hooks.json`.

## Use

Invoke the **business-engineer** with a PRD to run the Specification loop end to end, or the
**technical-engineer** with an issue/story reference to drive a single task to a draft PR. See the
repo docs for detail:

- `docs/getting-started.md` — what Neo is and the quickest path in.
- `docs/guides/using-neo.md` — driving the crew through the Specification loop.
- `docs/concepts/process-flow.md` — the workflow and integration modes.
- `docs/contributing/guides/observability.md` — the logging/tuning setup.
- `docs/contributing/reference/plugin-contract.md` — the normative folder shape, manifest fields, and naming.

> Copilot is the canonical, sole harness (issue #34). A Claude Code mirror may be regenerated
> from the Copilot source later if there is demand.

## License

MIT
