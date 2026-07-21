# AGENTS.md

Neo is a concept-to-spec-to-PR multi-agent coding system for GitHub Copilot CLI.
This repo is a **distribution repo** — a collection of agents, skills, instructions,
and hooks shipped as plugins for a single harness. It is **not** an application:
there is no frontend, no backend, no compiled artifact, and no build. It is a tree
of Markdown, JSON, Bash, and Python.

Copilot is the **canonical, sole harness** (decided in issue #34). The Claude Code
tree was dropped and deferred — a Claude mirror may be regenerated from the Copilot
source later if there is demand. Until then, do not add `agents/`, `skills/`, or
`.claude-plugin/` trees back.

Every core agent points here as the source of truth for layout, commands, style, and
guardrails. Keep it accurate.

## Layout

This is a **monorepo of plugins**. Shipped crews live under `plugins/`; the root holds the
marketplace manifests, docs, and dev-time-only tooling. Anything under `plugins/*/` is
shipped; the repo-root agent trees are **dev-time only**.

```javascript
plugins/neo-core/                    The shipped plugin — a Copilot tree:
  .github/agents/                    Copilot agents — neo.<role>.agent.md
  .github/skills/                    Copilot skills — neo-<name>/SKILL.md
  .github/plugin/plugin.json         Copilot plugin manifest
  .github/hooks/hooks.json           Copilot hook config (v1 schema, ${PLUGIN_ROOT})
  .agent-hooks/log-event.sh          the observability logger
  scripts/analyze_agent_logs.py      per-agent / per-run log stats
.github/plugin/marketplace.json      Copilot marketplace (root, lists plugins[])
.github/agents/neo.master-control.agent.md   DEV-TIME agent (Copilot), never shipped
scripts/validate-plugins.py          CI plugin check (manifests + agents: allowlists)
docs/                                Grouped by genre — see docs/README.md for the map
```

The shipped agents (in `plugins/neo-core/`): `technical-engineer` (orchestrator — start
here), `researcher`, `implementation-planner`, `code-writer`, `code-reviewer`,
`feature-agent`, `task-planner`. `master-control` is dev-time only and lives at the repo
root, never in a plugin.

## Naming

All normative in `docs/reference/plugin-contract.md` — don't restate it, conform to it.

- Copilot agents: `neo.<role>.agent.md` (e.g. `neo.code-writer.agent.md`).
- Kebab-case roles; each agent's frontmatter `name:` is `Neo <Role>`.
- Skills are `neo-` prefixed when neo-authored; vendored skills keep their upstream name.

## Checks (there is no build)

This repo has nothing to compile, lint, or unit-test in the app sense. Do **not** run
`bun`, `dotnet`, or invent a build. What actually needs to hold before you finish:

- **JSON manifests are valid.** The root Copilot marketplace manifest
  (`.github/plugin/marketplace.json`) and each plugin's Copilot `plugin.json` and
  `hooks.json` under `plugins/*/.github/` parse and carry required fields.
- **Agent frontmatter is valid** — `name:`, `tools:`, `agents:` allowlists resolve to
  real agent names.
- **Plugins validate** — run `python3 scripts/validate-plugins.py`. It walks every
  `plugins/*/`, checks the Copilot manifest + hooks parse, and fails on any `agents:`
  allowlist entry that doesn't resolve to a real agent `name:`. CI runs it via
  `.github/workflows/validate.yml`.

Quick manifest sanity check:

```bash
for f in .github/plugin/marketplace.json \
         plugins/*/.github/plugin/plugin.json \
         plugins/*/.github/hooks/hooks.json; do
  python3 -c "import json,sys; json.load(open('$f'))" && echo "ok  $f" || echo "BAD $f"
done
python3 scripts/validate-plugins.py
```

## Guardrails

- **Never commit or push to `main`.** All work happens on a feature branch. This must
  also be enforced at the harness/permission level (or a pre-commit hook) — do not rely
  on this line alone.
- Don't edit generated logs (`.agent-logs/`, `*.jsonl`).

## Gotchas

- `docs/README.md` maps the docs by genre (concepts / reference / guides / archive).
- `docs/reference/plugin-contract.md` is the **normative** contract — folder shape, manifest
  fields, naming. When in doubt, it wins.
- `docs/glossary.md` owns the vocabulary; `docs/reference/stack-plugin-contract.md` owns the
  core/stack split; `docs/concepts/process-flow.md` owns the workflow and integration modes.
- Don't restate rules across files — point to the owning doc.
- **Repo-root agent trees are dev-time; `plugins/*/` is shipped.** `master-control` lives at
  the root (`.github/agents/`) so it's visible to neo devs but never packaged. A role ships
  iff its file is under a `plugins/*/` tree.
- **Copilot-only (issue #34).** The Claude tree was dropped; don't reintroduce `agents/`,
  `skills/`, `.claude/`, or `.claude-plugin/` unless a Claude mirror is deliberately revived.
- Plugins are self-contained on install: a plugin can't reference files outside its own
  directory (`../neo-react/...` or a repo-root file won't be copied). Shared content must
  be duplicated into each plugin.
- The **consuming** repo also needs its own `AGENTS.md` (commands, layout, style,
  integration mode) — that is the user's artifact, distinct from this one, which describes
  how to work on neo itself.
