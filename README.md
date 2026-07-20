# Neo Agentic Development System

A concept-to-spec-to-PR multi-agent coding system for GitHub Copilot and Claude Code.

Initiate a new product platform (greenfield) or an existing codebase (brownfield) by invoking the **business engineer**. The orchestrator drives it through research → plan → implement → review → draft PR.

Initiate a new feature and taskset. Given a GitHub Issue or Azure DevOps story, an orchestrator drives it through
research → plan → implement → review → draft PR.

## Layout

This is a **monorepo of plugins**. The shipped crew lives in `plugins/neo-core/`; the repo root
holds manifests, docs, and dev-time-only tooling.

- `AGENTS.md` — project context both harnesses read (layout, checks, guardrails).
- `plugins/neo-core/` — the shipped plugin. Agents (`technical-engineer` orchestrator, plus
  `researcher`, `implementation-planner`, `code-writer`, `code-reviewer`, `feature-agent`,
  `task-planner`), the two authoring skills, the observability hooks + logger, and
  `analyze_agent_logs.py`.
- `.github/agents/` + `.claude/agents/` (repo root) — `master-control`, the **dev-time**
  agent that authors this harness config. Never shipped.
- `.github/plugin/marketplace.json` + `.claude-plugin/marketplace.json` — the marketplace
  manifests (stay at root, list `plugins/neo-core`).
- `scripts/validate-mirrors.py` — CI check that every plugin's Copilot ↔ Claude trees stay in sync.
- `docs/` — normative contracts and manuals (not shipped).

## Start

Invoke the **technical-engineer** with an issue/story reference. See `docs/process-flow.md`
for the workflow and `docs/observability.md` for the logging/tuning setup.

## Install as a plugin

Each plugin is packaged for both harnesses from one tree. Each harness reads its own manifest,
so there's no cross-contamination. See [`docs/plugin-contract.md`](docs/plugin-contract.md) for
the normative contract — folder shape, required manifest fields, the dual-manifest rule, and
`neo-` naming:

- **Claude Code** reads `.claude-plugin/marketplace.json` → the `neo-core` plugin under
  `plugins/neo-core/` → agents from `agents/` (Claude subagent format), skills from `skills/`,
  hooks from `hooks/hooks.json` (`${CLAUDE_PLUGIN_ROOT}`).
- **Copilot CLI** reads `.github/plugin/marketplace.json` (checked before `.claude-plugin/`) →
  agents from `.github/agents/` (`*.agent.md`), skills from `.github/skills/`, hooks from
  `.github/hooks/hooks.json` (v1 schema, `${PLUGIN_ROOT}`).

The marketplace is `neo`; the plugin is `neo-core`.

### Claude Code

```
/plugin marketplace add skyarkitekten/neo
/plugin install neo-core@neo
```

### GitHub Copilot CLI

```
copilot plugin marketplace add skyarkitekten/neo
copilot plugin install neo-core@neo
```

Copilot CLI also picks up the repo-root `.github/agents/` automatically for anyone working
**inside** this repo — that's just `master-control` for editing the harness config. The plugin
path above is for using the shipped crew in *other* projects.
