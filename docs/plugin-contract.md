# Plugin Contract Spec

Terms in **bold** are defined in the [glossary](./glossary.md).

This is the **normative** contract for packaging this repo as plugins for **GitHub Copilot
CLI** from one source tree. It defines the monorepo layout, per-plugin folder shape, manifest
fields, and the `neo-` naming convention.

> **Single harness (issue #34).** Neo ships for GitHub Copilot CLI only. Copilot is the
> **canonical, sole source**. The Claude Code tree was dropped and deferred — a Claude mirror
> may be regenerated from the Copilot source later if there is demand. Until then this repo
> carries no `agents/`, `skills/`, `.claude/`, or `.claude-plugin/` trees, and there is no
> mirror or dual-manifest rule to maintain.

Neo is a **monorepo of plugins**. Shipped plugins live under `plugins/`; today there is one,
`plugins/neo-core/`. The repo root holds the marketplace manifest, docs, and dev-time-only
tooling. Per-stack plugins (e.g. a hypothetical `plugins/neo-react/`) are added the same way
`neo-core` is packaged — this contract governs all of them.

All statements here were verified against the manifest, agent, hook, and skill files in this
repo. Field names, filenames, and values are transcribed from those files, not inferred.

## 0. Monorepo layout

```
neo/
├── .github/
│   ├── plugin/
│   │   └── marketplace.json          # Copilot marketplace — lists plugins[], stays at root
│   └── agents/
│       └── neo.master-control.agent.md   # DEV-TIME agent (Copilot), never shipped
├── plugins/
│   └── neo-core/                     # a shipped plugin (see §1 for its shape)
├── scripts/
│   └── validate-plugins.py           # CI: asserts each plugin's Copilot manifests + allowlists are valid
└── docs/                             # this spec, glossary, architecture, etc. — not shipped
```

**Dev-time vs shipped.** Anything under `plugins/*/` is shipped to installers. The repo-root
`.github/agents/` tree is **dev-time only** — it holds `master-control`, the agent that authors
this harness config, which is visible to neo developers working inside the repo but never
packaged into a plugin. There is no exclusion mechanism to maintain: a role is shipped iff its
file lives under a `plugins/*/` tree.

## 1. Plugin folder shape

Each plugin under `plugins/` is a self-contained Copilot tree:

```
plugins/neo-core/
├── .github/
│   ├── plugin/
│   │   └── plugin.json               # Copilot plugin metadata (adds agents/hooks paths)
│   ├── agents/                       # Copilot subagents — dotted neo.<role>.agent.md
│   ├── hooks/
│   │   └── hooks.json                # Copilot hook schema (v1, camelCase events, ${PLUGIN_ROOT})
│   └── skills/                       # Copilot Agent Skills, e.g. neo-task-authoring/SKILL.md
├── .agent-hooks/
│   ├── log-event.sh                  # observability logger, called by hooks.json
│   ├── enforce-guardrails.sh         # preToolUse enforcement (Unix), called by hooks.json
│   └── enforce-guardrails.ps1        # preToolUse enforcement (Windows/PowerShell sibling)
└── scripts/                          # plugin-local tooling, e.g. analyze_agent_logs.py
```

| Path (within a plugin)       | Purpose                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `.github/plugin/plugin.json` | Plugin metadata (name, version, author, keywords, …) plus `agents`/`hooks` paths.               |
| `.github/agents/`            | Subagent definitions, one dotted `neo.<role>.agent.md` file per role.                           |
| `.github/skills/`            | Agent Skills, e.g. `neo-task-authoring/SKILL.md`.                                                |
| `.github/hooks/hooks.json`   | Lifecycle-logging **and** `preToolUse` enforcement hooks, Copilot event names, `${PLUGIN_ROOT}`, versioned schema (`"version": 1`). |
| `.agent-hooks/log-event.sh`  | The observability logger `hooks.json` shells out to (fail-open). See [observability.md](observability.md). |
| `.agent-hooks/enforce-guardrails.sh` | The `preToolUse` enforcement hook `hooks.json` shells out to on Unix (fail-closed): blocks commit/push to `main` and non-draft PRs. A `.ps1` sibling covers Windows. See [enforcement.md](enforcement.md). |

**No cross-plugin file references.** A plugin is copied as a self-contained directory on
install. A file under `plugins/neo-core/` cannot reference a path outside its own plugin
directory (`../neo-react/...` or a repo-root file won't be copied). Any content two plugins
need must be duplicated into each.

## 2. Required manifest fields

Field lists below are transcribed from the manifest files as they exist today. **Required**
means the field is present and populated.

### 2.1 `plugins/neo-core/.github/plugin/plugin.json`

| Field         | Value                                            | Status                                      |
| ------------- | ------------------------------------------------ | ------------------------------------------- |
| `name`        | `"neo-core"`                                     | Required.                                    |
| `version`     | `"0.1.0"`                                        | Required.                                    |
| `description` | present ("… Copilot CLI manifest")               | Required.                                    |
| `author.name` | `"Chad Thomas"`                                  | Required.                                    |
| `homepage`    | `"https://github.com/skyarkitekten/neo"`         | Required.                                    |
| `repository`  | `"https://github.com/skyarkitekten/neo"`         | Required.                                    |
| `license`     | `"MIT"`                                          | Required.                                    |
| `keywords[]`  | 6 entries                                        | Required.                                    |
| `agents`      | `".github/agents"`                               | Required — points at the plugin's agent tree. |
| `hooks`       | `".github/hooks/hooks.json"`                     | Required — points at the plugin's hook config. |

### 2.2 Root `.github/plugin/marketplace.json`

The marketplace manifest stays at the repo root and lists each shipped plugin under `plugins[]`.

| Field                   | Value                                 | Status                                    |
| ----------------------- | ------------------------------------- | ----------------------------------------- |
| `name` (top-level)      | `"neo"`                               | Required — the marketplace name.          |
| `owner.name`            | `"skyarkitekten"`                     | Required.                                  |
| `metadata.description`  | present                               | Required.                                  |
| `metadata.version`      | `"0.1.0"`                             | Required.                                  |
| `plugins[].name`        | `"neo-core"`                          | Required.                                  |
| `plugins[].source`      | `"./plugins/neo-core"`                | Required — `./`-prefixed repo-root path.   |
| `plugins[].description` | present                               | Required.                                  |
| `plugins[].version`     | `"0.1.0"`                             | Required.                                  |
| `plugins[].author.name` | `"Chad Thomas"`                       | Required.                                  |
| `plugins[].license`     | `"MIT"`                               | Required.                                  |
| `plugins[].keywords[]`  | 4 entries                             | Required.                                  |
| `plugins[].agents`      | `".github/agents"`                    | Required.                                  |
| `plugins[].hooks`       | `".github/hooks/hooks.json"`          | Required.                                  |

**`source` rule:** always write the `./`-prefixed relative path from the repo root to the
plugin directory (`"./plugins/neo-core"`).

## 3. How Copilot loads the plugin

Copilot CLI reads the root `.github/plugin/marketplace.json` → resolves each plugin's `source`
→ reads that plugin's `.github/plugin/plugin.json` → agents from `.github/agents/`, skills from
`.github/skills/`, hooks from `.github/hooks/hooks.json` (Copilot v1 schema, `${PLUGIN_ROOT}`).

Every shipped plugin must carry its Copilot `plugin.json` and `hooks.json`; a missing or
invalid manifest breaks the plugin. `scripts/validate-plugins.py` enforces that both parse.

### 3.1 What must stay consistent

- `name` — `"neo"` (marketplace top-level) and `"neo-core"` (the plugin).
- `version` (`"0.1.0"`) — the `plugin.json` and the marketplace's nested `metadata.version`
  and `plugins[].version`.
- `license`, `author.name` / `owner.name` — identity describes one project.
- `keywords[]` — kept meaningful per manifest.
- `plugins[].source` — the `./`-prefixed value pointing at the plugin directory.

### 3.2 Claude Code (deferred)

The Claude Code harness was dropped in issue #34. If a Claude mirror is later revived, it would
be **generated from the Copilot source** (Copilot's frontmatter is the richer, more granular
form, so a Copilot→Claude projection collapses cleanly; the reverse cannot). This spec would
then regain a generated-tree section and a "generated output is up to date" CI gate. Nothing in
the repo depends on Claude today.

## 4. `neo-` naming

Every agent and skill identifier is namespaced under `neo-` to avoid collisions when a plugin
sits in a marketplace alongside others.

- **Namespace prefix:** both agent and skill identifiers carry an explicit `neo-` prefix. Agents
  and skills are addressable by bare name within a session, so the prefix must live in the
  identifier itself, not only in the plugin name.
- **kebab-case rule:** the canonical identifier form is lowercase words joined by hyphens — no
  underscores, no camelCase, no spaces (`code-reviewer`, `task-authoring`,
  `implementation-planner`). This applies to the role segment of an agent identifier and to skill
  names.
- **Copilot's dotted form** (`neo.<role>.agent.md`) is Copilot CLI's own agent-file convention
  (dot-separated namespace segment + a mandatory `.agent.md` suffix). The `<role>` segment stays
  kebab-case; only the separator after `neo` and the file suffix differ from a plain kebab name.
  This is an accepted harness-imposed grammar, not a violation of the per-word kebab-case rule.
- **Copilot skill directory:** `.github/skills/neo-<name>/SKILL.md`, and the frontmatter `name:`
  matches the directory name (e.g. `.github/skills/neo-feature-authoring/SKILL.md` →
  `name: neo-feature-authoring`).

Copilot resolves delegated agents by their frontmatter `name:` field, not the filename, so an
agent's `agents:` allowlist must reference real `name:` values. `scripts/validate-plugins.py`
walks every `plugins/*/` and fails CI on any allowlist entry that doesn't resolve.

### Vendored skills

Neo-authored skills carry the `neo-` prefix. A skill **vendored** from an upstream source keeps
its upstream name unchanged (no `neo-` prefix), since its identity is owned elsewhere. There are
no vendored skills in `neo-core` today; both current skills (`neo-feature-authoring`,
`neo-task-authoring`) are neo-authored.
