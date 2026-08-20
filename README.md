# Neo Agentic Development System

A concept-to-spec-to-PR multi-agent coding system for GitHub Copilot CLI.

Initiate a new product platform (greenfield) or an existing codebase (brownfield) by invoking the **Neo Product Engineer**. It drives research → viability/desirability/feasibility lenses → synthesis → a PRD, which the Specification loop then segments into features and tasks.

Initiate a new feature and taskset. Given a GitHub Issue or Azure DevOps story, an orchestrator drives it through
research → plan → implement → review → draft PR.

## Layout

This is a **monorepo of plugins**. The shipped crew lives in `plugins/neo-core/`; the repo root
holds manifests, docs, and dev-time-only tooling.

- `AGENTS.md` — project context agents read (layout, checks, guardrails).
- `plugins/neo-core/` — the shipped plugin. Agents (`technical-engineer` orchestrator, plus
  `researcher`, `implementation-planner`, `code-writer`, `code-reviewer`, `feature-agent`,
  `task-planner`), the two authoring skills, the observability hooks + logger, and
  `analyze_agent_logs.py`.
- `.github/agents/` (repo root) — `master-control`, the **dev-time** agent that authors this
  harness config. Never shipped.
- `.github/plugin/marketplace.json` — the marketplace manifest (stays at root, lists
  `plugins/neo-core`).
- `scripts/validate-plugins.py` — CI check that every plugin's Copilot manifest, hooks, and
  `agents:` allowlists are valid.
- `docs/` — the design record and manual. Two doors: user docs at the top level
  (`getting-started.md`, `guides/`), contributor docs under `docs/contributing/`. See
  `docs/README.md`. Not shipped.

## Start

New here? Start at [`docs/getting-started.md`](docs/getting-started.md). To run the crew, invoke the
**technical-engineer** with an issue/story reference; see
[`docs/guides/using-neo.md`](docs/guides/using-neo.md) for the workflow and
`docs/concepts/process-flow.md` for the loop boundaries.

## Install as a plugin

The plugin is packaged for GitHub Copilot CLI. See
[`docs/contributing/reference/plugin-contract.md`](docs/contributing/reference/plugin-contract.md) for the normative contract — folder
shape, required manifest fields, and `neo-` naming. Copilot reads
`.github/plugin/marketplace.json` → the `neo-core` plugin under `plugins/neo-core/` → agents
from `.github/agents/` (`*.agent.md`), skills from `.github/skills/`, hooks from
`.github/hooks/hooks.json` (v1 schema, `${PLUGIN_ROOT}`).

The marketplace is `neo`; the plugin is `neo-core`.

> Copilot is the canonical, sole harness (issue #34). A Claude Code mirror may be regenerated
> from the Copilot source later if there is demand.

### GitHub Copilot CLI

```
copilot plugin marketplace add skyarkitekten/neo
copilot plugin install neo-core@neo
```

Copilot CLI also picks up the repo-root `.github/agents/` automatically for anyone working
**inside** this repo — that's just `master-control` for editing the harness config. The plugin
path above is for using the shipped crew in *other* projects.
