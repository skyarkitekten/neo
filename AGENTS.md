# AGENTS.md

Neo is a concept-to-spec-to-PR multi-agent coding system for GitHub Copilot and
Claude Code. This repo is a **distribution repo** — a collection of agents, skills,
instructions, and hooks shipped as plugins for two harnesses. It is **not** an
application: there is no frontend, no backend, no compiled artifact, and no build.
It is a tree of Markdown, JSON, Bash, and Python.

Every core agent points here as the source of truth for layout, commands, style, and
guardrails. Keep it accurate.

## Layout

```javascript
.github/agents/      Copilot agents — neo.<role>.agent.md
agents/              Claude agents  — neo-<role>.md   (mirror of the above)
.github/skills/      Skills: feature-authoring, task-authoring (Copilot side)
.github/plugin/      Copilot plugin manifests: plugin.json, marketplace.json
.claude-plugin/      Claude plugin manifests: plugin.json, marketplace.json
.github/hooks/       Copilot hook config (v1 schema, ${PLUGIN_ROOT})
hooks/               Claude hook config (${CLAUDE_PLUGIN_ROOT})
.agent-hooks/        log-event.sh — the observability logger
scripts/             analyze_agent_logs.py — per-agent / per-run log stats
docs/                Normative contracts, glossary, process flow, manuals
```

The agents: `technical-engineer` (orchestrator — start here), `researcher`, `planner`
(`implementation-planner`), `code-writer`, `code-reviewer`, `feature-agent`,
`task-planner`, `master-control`.

## Naming

All normative in `docs/plugin-contract.md` — don't restate it, conform to it.

- Copilot agents: `neo.<role>.agent.md` (e.g. `neo.code-writer.agent.md`).
- Claude agents: `neo-<role>.md` (e.g. `neo-code-writer.md`).
- Kebab-case roles; each agent's frontmatter `name:` is `Neo <Role>`.
- Skills are `neo-` prefixed when neo-authored; vendored skills keep their upstream name.
- Both trees must hold matching artifacts — see the mirror rule.

## Checks (there is no build)

This repo has nothing to compile, lint, or unit-test in the app sense. Do **not** run
`bun`, `dotnet`, or invent a build. What actually needs to hold before you finish:

- **JSON manifests are valid.** Both `.github/plugin/*.json` and `.claude-plugin/*.json`
  parse and carry required fields. Copilot's is checked first; a missing Copilot manifest
  is an **error**, not a warning — it silently falls back to Claude-format agents it
  can't read.
- **Agent frontmatter is valid** — `name:`, `tools:`, `agents:` allowlists resolve to
  real agent names.
- **The two trees are in sync** — every Copilot agent has its Claude mirror and vice
  versa (the mirror rule).

Quick manifest sanity check:

```bash
for f in .github/plugin/*.json .claude-plugin/*.json .github/hooks/hooks.json hooks/hooks.json; do
  python3 -c "import json,sys; json.load(open('$f'))" && echo "ok  $f" || echo "BAD $f"
done
```

## Guardrails

- **Never commit or push to `main`.** All work happens on a feature branch. This must
  also be enforced at the harness/permission level (or a pre-commit hook) — do not rely
  on this line alone.
- Don't edit generated logs (`.agent-logs/`, `*.jsonl`).

## Gotchas

- `docs/plugin-contract.md` is the **normative** contract — folder shape, manifest fields,
  the dual-manifest rule, naming. When in doubt, it wins.
- `docs/glossary.md` owns the vocabulary; `docs/packaging.md` owns the core/stack split;
  `docs/process-flow.md` owns the workflow and integration modes.
- Don't restate rules across files — point to the owning doc.
- Plugins are self-contained on install: a plugin can't reference files outside its own
  directory (`../neo-core/...` won't be copied). Shared content must be duplicated.
- The **consuming** repo also needs its own `AGENTS.md` (commands, layout, style,
  integration mode) — that is the user's artifact, distinct from this one, which describes
  how to work on neo itself.
