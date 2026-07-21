# Neo Agentic Development System

A concept-to-spec-to-PR multi-agent coding system for GitHub Copilot CLI.

Initiate a new product platform (greenfield) or an existing codebase (brownfield) by invoking the **business engineer**. The orchestrator drives it through research → plan → implement → review → draft PR.

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
- `docs/` — normative contracts and manuals (not shipped).

## Start

Invoke the **technical-engineer** with an issue/story reference. See `docs/process-flow.md`
for the workflow and `docs/observability.md` for the logging/tuning setup.

## Install as a plugin

The plugin is packaged for GitHub Copilot CLI. See
[`docs/plugin-contract.md`](docs/plugin-contract.md) for the normative contract — folder
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
