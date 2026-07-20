# AGENTS.md

Neo is a concept-to-spec-to-PR multi-agent coding system for GitHub Copilot and
Claude Code. This repo is a **distribution repo** — a collection of agents, skills,
instructions, and hooks shipped as plugins for two harnesses. It is **not** an
application: there is no frontend, no backend, no compiled artifact, and no build.
It is a tree of Markdown, JSON, Bash, and Python.

Every core agent points here as the source of truth for layout, commands, style, and
guardrails. Keep it accurate.

## Layout

This is a **monorepo of plugins**. Shipped crews live under `plugins/`; the root holds the
marketplace manifests, docs, and dev-time-only tooling. Anything under `plugins/*/` is
shipped; the repo-root agent trees are **dev-time only**.

```javascript
plugins/neo-core/                    The shipped plugin — a dual-harness tree:
  .github/agents/                    Copilot agents — neo.<role>.agent.md
  agents/                            Claude agents  — neo-<role>.md  (mirror)
  .github/skills/                    Copilot skills — neo-<name>/SKILL.md
  skills/                            Claude skills  — neo-<name>/SKILL.md  (mirror)
  .github/plugin/plugin.json         Copilot plugin manifest
  .claude-plugin/plugin.json         Claude plugin manifest
  .github/hooks/hooks.json           Copilot hook config (v1 schema, ${PLUGIN_ROOT})
  hooks/hooks.json                   Claude hook config (${CLAUDE_PLUGIN_ROOT})
  .agent-hooks/log-event.sh          the observability logger
  scripts/analyze_agent_logs.py      per-agent / per-run log stats
.github/plugin/marketplace.json      Copilot marketplace (root, lists plugins[])
.claude-plugin/marketplace.json      Claude marketplace (root, lists plugins[])
.github/agents/neo.master-control.agent.md   DEV-TIME agent (Copilot), never shipped
.claude/agents/neo-master-control.md         DEV-TIME agent (Claude), never shipped
scripts/validate-mirrors.py          CI mirror check (Copilot ↔ Claude parity)
docs/                                Normative contracts, glossary, process flow, manuals
```

The shipped agents (in `plugins/neo-core/`): `technical-engineer` (orchestrator — start
here), `researcher`, `implementation-planner`, `code-writer`, `code-reviewer`,
`feature-agent`, `task-planner`. `master-control` is dev-time only and lives at the repo
root, never in a plugin.

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

- **JSON manifests are valid.** The root marketplace manifests (`.github/plugin/marketplace.json`,
  `.claude-plugin/marketplace.json`) and each plugin's `plugin.json` under `plugins/*/` parse
  and carry required fields. Copilot's is checked first; a missing Copilot manifest is an
  **error**, not a warning — it silently falls back to Claude-format agents it can't read.
- **Agent frontmatter is valid** — `name:`, `tools:`, `agents:` allowlists resolve to
  real agent names.
- **The two trees are in sync** — every Copilot agent/skill has its Claude mirror and vice
  versa (the mirror rule). Run `python3 scripts/validate-mirrors.py` — it walks every
  `plugins/*/` and fails on any roster/skill mismatch or missing manifest. CI runs it via
  `.github/workflows/validate.yml`.

Quick manifest sanity check:

```bash
for f in .github/plugin/marketplace.json .claude-plugin/marketplace.json \
         plugins/*/.github/plugin/plugin.json plugins/*/.claude-plugin/plugin.json \
         plugins/*/.github/hooks/hooks.json plugins/*/hooks/hooks.json; do
  python3 -c "import json,sys; json.load(open('$f'))" && echo "ok  $f" || echo "BAD $f"
done
python3 scripts/validate-mirrors.py
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
- **Repo-root agent trees are dev-time; `plugins/*/` is shipped.** `master-control` lives at
  the root (`.github/agents/`, `.claude/agents/`) so it's visible to neo devs but never
  packaged. A role ships iff its file is under a `plugins/*/` tree.
- Plugins are self-contained on install: a plugin can't reference files outside its own
  directory (`../neo-react/...` or a repo-root file won't be copied). Shared content must
  be duplicated into each plugin.
- The **consuming** repo also needs its own `AGENTS.md` (commands, layout, style,
  integration mode) — that is the user's artifact, distinct from this one, which describes
  how to work on neo itself.
