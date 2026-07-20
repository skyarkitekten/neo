# Plugin Contract Spec

Terms in **bold** are defined in the [glossary](./glossary.md).

This is the **normative** contract for packaging this repo as plugins for two harnesses —
**Claude Code** and **GitHub Copilot CLI** — from one source tree. It defines the monorepo
layout, per-plugin folder shape, manifest fields, the dual-manifest rule, and the `neo-`
naming convention.

Neo is a **monorepo of plugins**. Shipped plugins live under `plugins/`; today there is one,
`plugins/neo-core/`. The repo root holds the marketplace manifests, docs, and dev-time-only
tooling. Per-stack plugins (e.g. a hypothetical `plugins/neo-react/`) are added the same way
`neo-core` is packaged — this contract governs all of them.

All statements here were verified against the manifest, agent, hook, and skill files in this
repo. Field names, filenames, and values are transcribed from those files, not inferred.

## 0. Monorepo layout

```
neo/
├── .claude-plugin/
│   └── marketplace.json              # Claude marketplace — lists plugins[], stays at root
├── .github/
│   ├── plugin/
│   │   └── marketplace.json          # Copilot marketplace — lists plugins[], stays at root
│   └── agents/
│       └── neo.master-control.agent.md   # DEV-TIME agent (Copilot), never shipped
├── .claude/
│   └── agents/
│       └── neo-master-control.md         # DEV-TIME agent (Claude), never shipped
├── plugins/
│   └── neo-core/                     # a shipped plugin (see §1 for its shape)
├── scripts/
│   └── validate-mirrors.py           # CI: asserts each plugin's two trees stay in sync
└── docs/                             # this spec, glossary, architecture, etc. — not shipped
```

**Dev-time vs shipped.** Anything under `plugins/*/` is shipped to installers. The repo-root
`.github/agents/` and `.claude/agents/` trees are **dev-time only** — they hold `master-control`,
the agent that authors this harness config, which is visible to neo developers working inside
the repo but never packaged into a plugin. There is no exclusion mechanism to maintain: a
role is shipped iff its file lives under a `plugins/*/` tree.

## 1. Plugin folder shape

Each plugin under `plugins/` is a self-contained dual-harness tree:

```
plugins/neo-core/
├── .claude-plugin/
│   └── plugin.json                   # Claude plugin metadata
├── .github/
│   ├── plugin/
│   │   └── plugin.json               # Copilot plugin metadata (adds agents/hooks paths)
│   ├── agents/                       # Copilot subagents — dotted neo.<role>.agent.md
│   ├── hooks/
│   │   └── hooks.json                # Copilot hook schema (v1, camelCase events, ${PLUGIN_ROOT})
│   └── skills/                       # Copilot Agent Skills, e.g. neo-task-authoring/SKILL.md
├── agents/                           # Claude subagents — kebab-case neo-<role>.md
├── skills/                           # Claude Agent Skills, e.g. neo-task-authoring/SKILL.md
├── hooks/
│   └── hooks.json                    # Claude hook schema (PascalCase events, ${CLAUDE_PLUGIN_ROOT})
├── .agent-hooks/
│   └── log-event.sh                  # one shared hook implementation, called by BOTH hooks.json
└── scripts/                          # plugin-local tooling, e.g. analyze_agent_logs.py
```

| Path (within a plugin)       | Harness     | Purpose                                                                                          |
| ---------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `.claude-plugin/plugin.json` | Claude Code | Plugin metadata (name, version, author, keywords, …).                                           |
| `.github/plugin/plugin.json` | Copilot CLI | Plugin metadata; superset of Claude's fields (adds `agents`, `hooks` paths).                    |
| `agents/`                    | Claude Code | Subagent definitions, one kebab-case `neo-<role>.md` file per role.                             |
| `.github/agents/`            | Copilot CLI | Subagent definitions, one dotted `neo.<role>.agent.md` file per role.                           |
| `skills/`                    | Claude Code | Agent Skills, e.g. `neo-task-authoring/SKILL.md`.                                                |
| `.github/skills/`            | Copilot CLI | Agent Skills, e.g. `neo-task-authoring/SKILL.md`.                                                |
| `hooks/hooks.json`           | Claude Code | Lifecycle-logging hooks, Claude event names, `${CLAUDE_PLUGIN_ROOT}`.                           |
| `.github/hooks/hooks.json`   | Copilot CLI | Lifecycle-logging hooks, Copilot event names, `${PLUGIN_ROOT}`, versioned schema (`"version": 1`). |
| `.agent-hooks/log-event.sh`  | Both        | The one script both `hooks.json` files shell out to — config is per-harness, behavior is shared. |

**No cross-plugin file references.** A plugin is copied as a self-contained directory on
install. A file under `plugins/neo-core/` cannot reference a path outside its own plugin
directory (`../neo-react/...` or a repo-root file won't be copied). Any content two plugins
need must be duplicated into each.

## 2. Required manifest fields

Field lists below are transcribed from the manifest files as they exist today. **Required**
means the field is present and populated; **harness-specific** means the field exists only in
that harness's manifest.

### 2.1 `plugins/neo-core/**/plugin.json`

| Field         | `.claude-plugin/plugin.json`                    | `.github/plugin/plugin.json` | Status                                             |
| ------------- | ----------------------------------------------- | ---------------------------- | -------------------------------------------------- |
| `name`        | `"neo-core"`                                    | `"neo-core"`                 | Required, both — must match.                       |
| `version`     | `"0.1.0"`                                        | `"0.1.0"`                    | Required, both — must match.                       |
| `description` | present ("Portable across …")                    | present ("… Copilot CLI manifest") | Required, both — harness-tailored; intent must match. |
| `author.name` | `"Chad Thomas"`                                  | `"Chad Thomas"`              | Required, both — must match.                       |
| `homepage`    | `"https://github.com/skyarkitekten/neo"`         | same                         | Required, both — must match.                       |
| `repository`  | `"https://github.com/skyarkitekten/neo"`         | same                         | Required, both — must match.                       |
| `license`     | `"MIT"`                                          | `"MIT"`                      | Required, both — must match.                       |
| `keywords[]`  | 6 entries                                        | identical 6 entries          | Required, both — keep in sync.                     |
| `agents`      | _absent_ (resolved from conventional `agents/`)  | `".github/agents"`           | **Copilot-specific**, required for Copilot.        |
| `hooks`       | _absent_ (resolved from conventional `hooks/`)   | `".github/hooks/hooks.json"` | **Copilot-specific**, required for Copilot.        |

### 2.2 Root `marketplace.json`

The marketplace manifests stay at the repo root and list each shipped plugin under `plugins[]`.

| Field                   | `.claude-plugin/marketplace.json`     | `.github/plugin/marketplace.json` | Status                                        |
| ----------------------- | ------------------------------------- | --------------------------------- | --------------------------------------------- |
| `name` (top-level)      | `"neo"`                               | `"neo"`                           | Required, both — the marketplace name.        |
| `owner.name`            | `"skyarkitekten"`                     | `"skyarkitekten"`                 | Required, both — must match.                   |
| `owner.url`             | `"https://github.com/skyarkitekten"`  | _absent_                          | Optional, currently Claude-only.              |
| `metadata.description`  | present                               | present                           | Required, both — harness-tailored wording OK.  |
| `metadata.version`      | `"0.1.0"`                             | `"0.1.0"`                         | Required, both — must match.                   |
| `plugins[].name`        | `"neo-core"`                          | `"neo-core"`                      | Required, both — must match.                   |
| `plugins[].source`      | `"./plugins/neo-core"`                | `"./plugins/neo-core"`            | Required, both — same value, `./` prefix.      |
| `plugins[].description` | present                               | present                           | Required, both — harness-tailored wording OK.  |
| `plugins[].version`     | `"0.1.0"`                             | `"0.1.0"`                         | Required, both — must match.                   |
| `plugins[].author.name` | `"Chad Thomas"`                       | `"Chad Thomas"`                   | Required, both — must match.                   |
| `plugins[].license`     | `"MIT"`                               | `"MIT"`                           | Required, both — must match.                   |
| `plugins[].keywords[]`  | 4 entries                             | identical 4 entries               | Required, both — keep in sync.                 |
| `plugins[].agents`      | _absent_                              | `".github/agents"`                | **Copilot-specific**, required for Copilot.    |
| `plugins[].hooks`       | _absent_                              | `".github/hooks/hooks.json"`      | **Copilot-specific**, required for Copilot.    |

**`source` rule:** always write the `./`-prefixed relative path from the repo root to the
plugin directory (`"./plugins/neo-core"`). Claude requires the leading `./`; both manifests use
the identical value — do not let the two spellings drift.

## 3. The dual-manifest rule

Each harness reads **only its own manifest tree** and never the other's:

- **Claude Code** reads the root `.claude-plugin/marketplace.json` → resolves each plugin's
  `source` → reads that plugin's `.claude-plugin/plugin.json` → agents from `agents/`, skills
  from `skills/`, hooks from `hooks/hooks.json` (Claude event names, `${CLAUDE_PLUGIN_ROOT}`).
- **Copilot CLI** reads the root `.github/plugin/marketplace.json` → the plugin's
  `.github/plugin/plugin.json` → agents from `.github/agents/`, skills from `.github/skills/`,
  hooks from `.github/hooks/hooks.json` (Copilot v1 schema, `${PLUGIN_ROOT}`).
- **Copilot's `.github/plugin/` tree is checked _before_ `.claude-plugin/`.** A **missing
  Copilot manifest is an error, not a warning**: Copilot silently falls back to the Claude
  manifest, which it cannot read correctly. Every shipped plugin must carry both manifests.
  `scripts/validate-mirrors.py` enforces this.

**One source, two manifests, no cross-contamination:** one crew, one set of prompt intent, one
hook implementation (`.agent-hooks/log-event.sh`), expressed twice — once per harness's
manifest/agent/hook format. Neither harness reads or depends on the other's tree at runtime.

### What must stay in sync

- `name` — `"neo"` (marketplace top-level) and `"neo-core"` (the plugin), consistent across both
  harness manifests of each kind.
- `version` (`"0.1.0"`) — every `plugin.json` and every `marketplace.json`'s nested
  `metadata.version` and `plugins[].version`.
- `license`, `author.name` / `owner.name` — identity describes one project, not two.
- `keywords[]` — identical lists per manifest type.
- `plugins[].source` — identical `./`-prefixed value in both marketplace files.
- Description **intent** — literal text may be harness-tailored, but must describe the same crew.
- **Agent rosters and skill sets** — each plugin's Copilot and Claude trees must mirror
  role-for-role and skill-for-skill (see §4, enforced by `validate-mirrors.py`).

### What is legitimately harness-specific

- **`agents` / `hooks` path fields** — only Copilot's manifests declare these; Claude resolves
  the same information from fixed conventional paths. Both point at the harness's own subtree.
- **Agent file format** — Claude subagents are kebab-case `.md` in `agents/`; Copilot agents are
  dotted `*.agent.md` in `.github/agents/` (see §4).
- **Hook schema shape** — event-name casing (`SessionStart` vs `sessionStart`), the Copilot-only
  `version`/`timeoutSec` fields, and the root-var name (`${CLAUDE_PLUGIN_ROOT}` vs
  `${PLUGIN_ROOT}`) differ by design; both configs invoke the same script.

## 4. `neo-` naming and the mirror rule

Every agent and skill identifier is namespaced under `neo-` to avoid collisions when a plugin
sits in a marketplace alongside others.

- **Namespace prefix:** both agent and skill identifiers carry an explicit `neo-` prefix. Agents
  and skills are addressable by bare name within a session, so the prefix must live in the
  identifier itself, not only in the plugin name.
- **kebab-case rule:** the canonical identifier form is lowercase words joined by hyphens — no
  underscores, no camelCase, no spaces (`code-reviewer`, `task-authoring`,
  `implementation-planner`). This applies to the role segment of an agent identifier and to skill
  names.
- **Claude agent filename:** `agents/neo-<role>.md`, and the frontmatter `name:` matches the
  filename stem exactly (e.g. `agents/neo-code-reviewer.md` → `name: neo-code-reviewer`).
- **Claude skill directory:** `skills/neo-<name>/SKILL.md`, and the frontmatter `name:` matches
  the directory name (e.g. `skills/neo-feature-authoring/SKILL.md` → `name: neo-feature-authoring`).
- **Copilot's dotted form** (`neo.<role>.agent.md`) is Copilot CLI's own agent-file convention
  (dot-separated namespace segment + a mandatory `.agent.md` suffix). The `<role>` segment stays
  kebab-case; only the separator after `neo` and the file suffix differ from Claude's form. This
  is an accepted harness-imposed grammar, not a violation of the per-word kebab-case rule.
- **Copilot skill directory:** `.github/skills/neo-<name>/SKILL.md`, mirroring the Claude skill
  name exactly.

### The mirror rule

Every shipped role and skill exists **twice** — once per harness — from one intent. Editing one
side without the other is the characteristic defect of this repo. For each plugin:

- every Copilot agent `neo.<role>.agent.md` has a Claude mirror `neo-<role>.md`, and vice versa;
- every Copilot skill `.github/skills/neo-<name>/` has a Claude mirror `skills/neo-<name>/`, and
  vice versa;
- both `plugin.json` manifests are present and agree on the shared fields (§3).

This invariant is executable: `scripts/validate-mirrors.py` walks every `plugins/*/`, compares
the Copilot and Claude agent rosters and skill sets, and fails CI on any mismatch or missing
manifest. Run it after any change to a plugin's agents, skills, or manifests.

### Vendored skills

Neo-authored skills carry the `neo-` prefix. A skill **vendored** from an upstream source keeps
its upstream name unchanged (no `neo-` prefix), since its identity is owned elsewhere. There are
no vendored skills in `neo-core` today; both current skills (`neo-feature-authoring`,
`neo-task-authoring`) are neo-authored.
