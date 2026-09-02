# AGENTS.md

Neo is a concept-to-spec-to-PR multi-agent coding system for GitHub Copilot CLI.
This repo is a **distribution repo** — a collection of agents, skills, instructions,
and hooks shipped as plugins for a single harness. It is **not** an application:
there is no frontend, no backend, no compiled artifact, and no build. It is a tree
of Markdown, JSON, Bash, and Python.

Copilot is the **canonical, sole harness**. The Claude Code
tree was dropped and deferred — a Claude mirror may be created from the Copilot
source later if there is demand. Until then, do not add **repo-root** `agents/`, `skills/`, or
`.claude-plugin/` trees back. (Inside a plugin, `agents/` and `skills/` are the correct Copilot layout — this rule is about the repo root.)

Every core agent points here as the source of truth for layout, commands, style, and
guardrails. Keep it accurate.

## Layout

This is a **monorepo of plugins**. Shipped crews live under `plugins/`; the root holds the
marketplace manifests, docs, and dev-time-only tooling. Anything under `plugins/*/` is
shipped; the repo-root agent trees are **dev-time only**.

```javascript
plugins/neo-core/                    The coding + specification crew — a Copilot plugin tree:
  plugin.json                        Copilot plugin manifest (at the plugin ROOT, not .github/)
  agents/                            Copilot agents — neo.<role>.agent.md
  skills/                            Copilot skills — neo-<name>/SKILL.md
  hooks/hooks.json                   Copilot hook config (v1 schema, ${PLUGIN_ROOT})
  hooks/scripts/log-event.sh         the observability logger
  scripts/analyze_agent_logs.py      per-agent / per-run log stats
plugins/neo-product/                 The Product loop — same shape, grouped by discipline:
  plugin.json                        Copilot plugin manifest
  agents/                            neo.<domain>.<role>.agent.md
  skills/                            Copilot skills — neo-<name>/SKILL.md
  hooks/hooks.json                   Copilot hook config (v1 schema, ${PLUGIN_ROOT})
  hooks/scripts/log-event.sh         its own copy — plugins can't share files
.github/plugin/marketplace.json      Copilot marketplace (root, lists plugins[])
.github/agents/neo.master-control.agent.md   DEV-TIME agent (Copilot), never shipped
scripts/validate-plugins.py          CI plugin check (manifests + hooks + agents: allowlists)
scripts/linting/schemas/hook-manifest.schema.json   Hook-manifest JSON Schema (draft-07)
docs/                                Grouped by genre — see docs/README.md for the map
```

**A plugin tree has no `.github/`.** Plugin components sit at the plugin root, which is what
Copilot CLI documents and defaults to. `.github/` is the *repository*-scoped mechanism and is
used only at the repo root (marketplace manifest, dev-time `master-control`). Conflating the
two is what caused every shipped skill to silently fail to load — see the Gotchas below.

The shipped agents:

| Plugin                 | Agents                                                                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugins/neo-core/`    | `business-engineer` (Specification-loop orchestrator), `technical-engineer` (Coding-loop orchestrator — start here for one task), `researcher`, `implementation-planner`, `code-writer`, `code-reviewer`, `feature-agent`, `task-planner` |
| `plugins/neo-product/` | `product.engineer` (orchestrator — start here), `product.researcher`, `product.coach`, `design.thinking`, `systems.thinking`                              |

`master-control` is dev-time only and lives at the repo root, never in a plugin.

## Naming

All normative in `docs/contributing/reference/plugin-contract.md` — don't restate it, conform to it.

- Copilot agents: `neo.<role>.agent.md` (e.g. `neo.code-writer.agent.md`), or
  `neo.<domain>.<role>.agent.md` in a plugin that groups by discipline (e.g. `neo.design.ux.agent.md`).
- Kebab-case roles; each agent's frontmatter `name:` is `Neo <Role>`.
- Skills are `neo-` prefixed when Neo-authored; vendored skills keep their upstream name.

## Checks (there is no build)

This repo has nothing to compile, lint, or unit-test in the app sense. Do **not** run
`bun`, `dotnet`, or invent a build. What actually needs to hold before you finish:

- **JSON manifests are valid.** The root Copilot marketplace manifest
  (`.github/plugin/marketplace.json`) and each plugin's `plugin.json` and
  `hooks/hooks.json` parse and carry required fields.
- **Agent frontmatter is valid** — `name:`, `tools:`, `agents:` allowlists resolve to
  real agent names.
- **Plugins validate** — run `python3 scripts/validate-plugins.py` (`uv run scripts/validate-plugins.py`
  where `python3` isn't on PATH, e.g. Windows). It walks every
  `plugins/*/`, checks the Copilot manifest + hooks parse, asserts every declared component
  path (`agents`, `skills`, `hooks`) resolves to something real on disk, validates each
  `hooks.json` against the hook-manifest contract (`scripts/linting/schemas/hook-manifest.schema.json`
  — including the rule that a `powershell` command must use `$env:PLUGIN_ROOT`, not the
  bare `${PLUGIN_ROOT}`), rejects non-canonical hook event names, and fails on any `agents:`
  allowlist entry that doesn't resolve to a real agent `name:`. CI runs it via
  `.github/workflows/validate.yml`.
- **Plugins actually load.** Static validation can't prove a component reached the CLI. If you
  touched a manifest or moved a component, install into a throwaway `COPILOT_HOME` and read
  what the CLI reports:

  ```bash
  export COPILOT_HOME=$(mktemp -d)
  copilot plugin install ./plugins/neo-core    # must say "Installed 3 skills."
  copilot plugin install ./plugins/neo-product # must say "Installed 4 skills."
  copilot plugins list --kind skill --scope plugin
  ```

Quick manifest sanity check:

```bash
for f in .github/plugin/marketplace.json \
         plugins/*/plugin.json \
         plugins/*/hooks/hooks.json; do
  python3 -c "import json,sys; json.load(open('$f'))" && echo "ok  $f" || echo "BAD $f"
done
python3 scripts/validate-plugins.py
```

### Dev loop — testing a changed plugin in Copilot

Direct plugin installs (`copilot plugin install ./plugins/neo-core`) are deprecated as of
Copilot CLI 1.0.81 and will stop working in a future release. Use a **local
directory-source marketplace** instead. Copilot reads the plugin live from the repo
directory (no copy step), so edits take effect on the next invocation without reinstalling:

```console
# From the repo root (where .github/plugin/marketplace.json lives):
copilot plugin marketplace add .
copilot plugin install neo-core@neo
# optionally:
copilot plugin install neo-product@neo
```

The marketplace name (`neo`) comes from `"name"` in `.github/plugin/marketplace.json`.
Because the source is a local path, Copilot reads agents, skills, and hooks directly from
`plugins/neo-core/` — a change to any file is picked up immediately.

To clean up when done:

```console
copilot plugin uninstall neo-core
copilot plugin uninstall neo-product   # if installed
copilot plugin marketplace remove neo
```

> **Note:** `copilot plugin marketplace remove` may require the marketplace name (`neo`)
> rather than the path. If it prompts, supply `neo`.

## Guardrails

- **Never commit or push to `main`.** All work happens on a feature branch. Neo ships an
  opt-in `preToolUse` hook that enforces this (`docs/contributing/guides/enforcement.md`), but
  it is deliberately **not registered** — do not rely on it, and do not rely on this line
  alone. Server-side branch protection is the authoritative control.
- Don't edit generated logs (`.agent-logs/`, `*.jsonl`).

## Gotchas

- **A tool alias the harness doesn't recognize is silently ignored — not an error.** The documented
  `tools:` alias table describes the _cloud agent_; Copilot CLI resolves a narrower set. Probed against
  v1.0.80: `read`, `edit`, `execute`, and `agent` work; **`search`, `web`, `todo`, and `github/*` grant
  nothing at all.** So in the CLI an agent searches, fetches, and reaches GitHub through `execute`
  (`rg`, `curl`, `gh`). This has already bitten us: researchers declaring `[read, search, web, todo]`
  received only `view` and filled the gap with recalled training data wearing invented citations. Keep
  the portable aliases for cloud/VS Code parity, but any prompt that says "search" or "fetch" needs
  `execute` behind it. `scripts/validate-plugins.py` enforces this; the full table is in
  `docs/contributing/guides/agent-authoring-reference.md`.
- **No alias reaches a host tool — name it exactly or omit `tools:`.** Session spawning
  (`create_session`, `fork_session`, `open_pr_session`, …), `create_issue`, `create_pull_request`,
  canvases, and widgets are registered by the Copilot **desktop app**, not the CLI, so the alias
  resolver never produces them. The trap is `execute`: its grant includes "session management", but
  that is *shell* session management (`read_powershell`, `stop_powershell`, `list_powershell`), which
  reads identically and is not the same thing. An orchestrator declaring only aliases gets zero
  session tools, silently, and `/orchestrate`, `/pr-stack`, and any "spawn a child session"
  instruction simply do nothing — skills are prose and never grant tools. Naming host tools is
  portable, because unrecognized names are ignored elsewhere. Two caveats: host tools reach depth 0
  and depth 1 only ([copilot-cli#3293](https://github.com/github/copilot-cli/issues/3293)), so keep
  spawning at the selected agent; and they don't exist at all under bare `copilot`.
  `scripts/validate-plugins.py` enforces this too — a prompt that describes spawning while `tools:`
  omits `create_session` fails CI.
- **An undeclared component path fails silently — the plugin still installs.** Copilot CLI
  defaults `agents` to `agents/` and `skills` to `skills/` relative to the **plugin root**. If a
  component lives anywhere else and the manifest doesn't say so, the CLI finds nothing, contributes
  nothing, and reports success. This shipped: both plugins kept skills in `.github/skills/` without
  a `skills` key, so **every skill silently failed to load for several releases** (issue #81). Two
  rules follow — declare `agents`, `skills`, and `hooks` explicitly in every `plugin.json` even when
  the value matches the default, and never trust a green validator as proof a component loaded.
  Install into a throwaway `COPILOT_HOME` and read the skill count the CLI prints.
- **A `preToolUse` hook that can't *run* its script bricks the whole session — so Neo no longer
  ships one.** `preToolUse` is fail-closed: a non-zero exit denies the tool call, so a hook that
  fails to launch denies *every* call — `view` and `powershell` included — with
  `Denied by preToolUse hook (hook errored)`. `NEO_ENFORCE_GUARDRAILS=0` can't rescue it, because
  the script that reads that variable is the thing that isn't running. This shipped **twice**:
  a release moved hook scripts while long-lived sessions kept the previous manifest in memory
  (PR #93), and the manifest invoked the script as `& $s`, which runs a script *file* and is
  therefore blocked by PowerShell execution policy on a stock Windows client, where every scope is
  `Undefined` and the effective policy is `Restricted` (issue #95). Three rules follow, all
  enforced by `scripts/validate-plugins.py`: a shipped plugin registers **no** fail-closed event
  (the guardrail scripts stay in-tree and consuming repos opt in — see
  `docs/contributing/guides/enforcement.md`); every hook command still resolves its script into
  `$s` and `exit 0`s when it's absent; and every `powershell` command invokes via
  `pwsh -NoProfile -ExecutionPolicy Bypass -File "$s"`, never `& $s`. If you see blanket denials,
  restart the session first — a mid-session `plugin install` does not re-read hooks.
- **Evidence discipline is a shipped contract**, not a style preference — the `neo-evidence-standard`
  skill (duplicated into both plugins) owns the retrieval-or-silence rule and the
  `FACT` / `INFERENCE` / `RECALL — UNVERIFIED` labels. Agents that gather or consume evidence must load it.

- `docs/README.md` is a two-door hub: **user** docs (`getting-started.md`, `guides/`) sit at the
  `docs/` top level; **contributor** docs live under `docs/contributing/` (`reference/`, `guides/`,
  `design/`). `glossary.md` + `concepts/` are the shared core both doors point at.
- `docs/contributing/reference/plugin-contract.md` is the **normative** contract — folder shape, manifest
  fields, naming. When in doubt, it wins.
- `docs/glossary.md` owns the vocabulary; `docs/contributing/reference/stack-plugin-contract.md` owns the
  core/stack split; `docs/concepts/process-flow.md` owns the workflow and integration modes.
- Don't restate rules across files — point to the owning doc.
- **Repo-root agent trees are dev-time; `plugins/*/` is shipped.** `master-control` lives at
  the root (`.github/agents/`) so it's visible to Neo devs but never packaged. A role ships
  iff its file is under a `plugins/*/` tree.
- **Copilot-only (issue #34).** The Claude tree was dropped; don't reintroduce **repo-root**
  `agents/` or `skills/` directories, or `.claude/` / `.claude-plugin/`, unless a Claude mirror is
  deliberately revived. (Inside a plugin, `agents/` and `skills/` are the correct Copilot layout —
  this rule is about the repo root.)
- Plugins are self-contained on install: a plugin can't reference files outside its own
  directory (`../neo-react/...` or a repo-root file won't be copied). Shared content must
  be duplicated into each plugin.
- The **consuming** repo also needs its own `AGENTS.md` (commands, layout, style,
  integration mode, and **commit-message conventions**) — that is the user's artifact, distinct
  from this one, which describes how to work on Neo itself. The coding loop commits one commit
  per unit in [Conventional Commits](https://www.conventionalcommits.org/) form (owned by
  `neo.code-writer.agent.md`; see `docs/concepts/process-flow.md` § Boundary 2). A consuming repo
  may define its own scopes and extra types in its `AGENTS.md`, but stays within Conventional
  Commits — it is the required format, not just a default.
