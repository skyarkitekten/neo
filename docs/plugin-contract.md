# Plugin Contract Spec

Terms in **bold** are defined in the [glossary](./glossary.md).

This is the **normative** contract for packaging this repo as a plugin for two harnesses —
**Claude Code** and **GitHub Copilot CLI** — from one source tree. It defines the canonical
folder shape, manifest fields, the dual-manifest rule, and the `neo` naming convention. Where
the repo currently deviates from its own rule, that deviation is called out explicitly under
**Known drift** below and is *documented, not fixed*, by this spec.

All statements here were verified against the manifest, agent, hook, and skill files in this
repo as of this writing. Field names, filenames, and values are transcribed from those files,
not inferred.

## 1. Plugin folder shape

```
neo/
├── .claude-plugin/                   # Claude Code manifest tree
│   ├── plugin.json
│   └── marketplace.json
├── .github/
│   ├── plugin/                       # Copilot CLI manifest tree
│   │   ├── plugin.json
│   │   └── marketplace.json
│   ├── agents/                       # Copilot subagents — dotted *.agent.md
│   ├── hooks/
│   │   └── hooks.json                # Copilot hook schema (v1, camelCase events)
│   ├── skills/                       # Agent Skills, e.g. task-authoring/SKILL.md
│   └── copilot-hooks.template.json   # legacy hand-wired example, superseded by .github/hooks/hooks.json
├── agents/                           # Claude Code subagents — kebab-case *.md
├── hooks/
│   └── hooks.json                    # Claude hook schema (PascalCase events, ${CLAUDE_PLUGIN_ROOT})
├── .agent-hooks/
│   └── log-event.sh                  # single shared hook implementation, called by BOTH hooks.json files
└── docs/                             # this spec, glossary, architecture, etc.
```

| Path | Harness | Purpose |
|---|---|---|
| `.claude-plugin/plugin.json` | Claude Code | Plugin metadata (name, version, author, keywords, …). |
| `.claude-plugin/marketplace.json` | Claude Code | Marketplace listing — wraps `plugin.json`-shaped entries under `plugins[]`. |
| `.github/plugin/plugin.json` | Copilot CLI | Plugin metadata; superset of Claude's fields (adds `agents`, `hooks` paths). |
| `.github/plugin/marketplace.json` | Copilot CLI | Marketplace listing for Copilot; same `plugins[]` shape plus `agents`/`hooks`. |
| `agents/` | Claude Code | Subagent definitions, one kebab-case `neo-<role>.md` file per role. |
| `.github/agents/` | Copilot CLI | Subagent definitions, one dotted `neo.<role>.agent.md` file per role. |
| `hooks/hooks.json` | Claude Code | Lifecycle-logging hooks, Claude event names, `${CLAUDE_PLUGIN_ROOT}`. |
| `.github/hooks/hooks.json` | Copilot CLI | Lifecycle-logging hooks, Copilot event names, `${PLUGIN_ROOT}`, versioned schema (`"version": 1`). |
| `.agent-hooks/log-event.sh` | Both | The one script both `hooks.json` files shell out to — hook *config* is per-harness, hook *behavior* is shared. |
| `.github/skills/` | Copilot CLI | Agent Skills (e.g. `task-authoring/SKILL.md`). No equivalent top-level `skills/` tree exists for Claude Code today — skills currently ship Copilot-only. |
| `docs/` | Both | Harness-agnostic documentation: this spec, `glossary.md`, `architecture.md`, etc. |

## 2. Required manifest fields

Field lists below are transcribed from the four manifest files as they exist today. **Required**
means the field is present and populated in the current manifest of that kind; **harness-specific**
means the field exists only in that harness's manifest.

### 2.1 `plugin.json`

| Field | `.claude-plugin/plugin.json` | `.github/plugin/plugin.json` | Status |
|---|---|---|---|
| `name` | `"neo"` | `"neo"` | Required, both — must match. |
| `version` | `"0.1.0"` | `"0.1.0"` | Required, both — must match. |
| `description` | present (mentions "Portable across Claude Code and GitHub Copilot") | present (ends "GitHub Copilot CLI manifest") | Required, both — wording is harness-tailored; intent must match. |
| `author.name` | `"Chad Thomas"` | `"Chad Thomas"` | Required, both — must match. |
| `homepage` | `"https://github.com/skyarkitekten/neo"` | same | Required, both — must match. |
| `repository` | `"https://github.com/skyarkitekten/neo"` | same | Required, both — must match. |
| `license` | `"MIT"` | `"MIT"` | Required, both — must match. |
| `keywords[]` | 6 entries (`agents`, `orchestration`, `code-review`, `coding-agents`, `hooks`, `observability`) | identical 6 entries | Required, both — currently in sync. |
| `agents` | *absent* (Claude resolves agents from the conventional `agents/` path) | `".github/agents"` | **Copilot-specific**, required for Copilot. |
| `hooks` | *absent* (Claude resolves hooks from the conventional `hooks/hooks.json` path) | `".github/hooks/hooks.json"` | **Copilot-specific**, required for Copilot. |

### 2.2 `marketplace.json`

| Field | `.claude-plugin/marketplace.json` | `.github/plugin/marketplace.json` | Status |
|---|---|---|---|
| `name` (top-level) | `"neo"` | `"neo"` | Required, both — must match. |
| `owner.name` | `"skyarkitekten"` | `"skyarkitekten"` | Required, both — must match. |
| `owner.url` | `"https://github.com/skyarkitekten"` | *absent* | Optional, currently Claude-only. |
| `metadata.description` | present | present | Required, both — harness-tailored wording is fine. |
| `metadata.version` | `"0.1.0"` | `"0.1.0"` | Required, both — must match. |
| `plugins[].name` | `"neo"` | `"neo"` | Required, both — must match. |
| `plugins[].source` | `"./"` | `"."` | Required, both — **values differ; see Known drift.** |
| `plugins[].description` | present | present | Required, both — harness-tailored wording is fine. |
| `plugins[].version` | `"0.1.0"` | `"0.1.0"` | Required, both — must match. |
| `plugins[].author.name` | `"Chad Thomas"` | `"Chad Thomas"` | Required, both — must match. |
| `plugins[].license` | `"MIT"` | `"MIT"` | Required, both — must match. |
| `plugins[].keywords[]` | 4 entries (`agents`, `orchestration`, `code-review`, `hooks`) | identical 4 entries | Required, both — currently in sync. |
| `plugins[].agents` | *absent* | `".github/agents"` | **Copilot-specific**, required for Copilot. |
| `plugins[].hooks` | *absent* | `".github/hooks/hooks.json"` | **Copilot-specific**, required for Copilot. |

## 3. The dual-manifest rule

Each harness reads **only its own manifest tree** and never the other's:

- **Claude Code** reads `.claude-plugin/{plugin,marketplace}.json` → agents from `agents/` →
  hooks from `hooks/hooks.json` (Claude event names, `${CLAUDE_PLUGIN_ROOT}`).
- **Copilot CLI** reads `.github/plugin/{plugin,marketplace}.json` → agents from
  `.github/agents/` → hooks from `.github/hooks/hooks.json` (Copilot v1 schema,
  `${PLUGIN_ROOT}`).
- **Copilot's `.github/plugin/` tree is checked *before* `.claude-plugin/`.** Because both
  trees live in the same repo, path resolution order matters even though the two harnesses
  don't share manifest content — Copilot must find its own tree first, or it would need to
  fall back to (and misinterpret) Claude's.

**One source, two manifests, no cross-contamination:** there is one crew, one set of prompts'
intent, and one hook implementation (`.agent-hooks/log-event.sh`), expressed twice — once per
harness's manifest/agent/hook format. Neither harness reads or depends on the other's tree at
runtime.

### What must stay in sync

- `name` (`"neo"`) — both manifests, both `plugin.json` and `marketplace.json`.
- `version` (`"0.1.0"`) — every one of the four manifest files, plus each `marketplace.json`'s
  nested `metadata.version` and `plugins[].version`.
- `license`, `author.name` / `owner.name` — identity must match; these describe one project,
  not two.
- `keywords[]` — currently identical lists per manifest type; drifting these would make the
  two marketplace listings look like different projects.
- Description **intent** (what the plugin is and does) — the literal text may be harness-tailored
  (see `description` rows above), but must describe the same crew and behavior.

### What is legitimately harness-specific

- **`agents` / `hooks` path fields** — only Copilot's manifests declare these; Claude resolves
  the same information from fixed conventional paths (`agents/`, `hooks/hooks.json`) instead of
  a manifest field. Both mechanisms point at "this harness's own subtree" — that's the contract,
  not a discrepancy.
- **`marketplace.json`'s `source` field** — each harness's marketplace entry declares its own
  relative source path; the two are allowed to differ in *notation* as long as they resolve to
  the same root. (Today they do resolve to the same thing but are spelled differently — see
  Known drift.)
- **Agent file format** — Claude subagents are kebab-case `.md` files in `agents/`; Copilot
  agents are dotted `*.agent.md` files in `.github/agents/`. This is an accepted per-harness
  file convention (see §4), not something the two harnesses need to reconcile.
- **Hook schema shape** — event name casing (`SessionStart` vs `sessionStart`), the Copilot-only
  `version` and `timeoutSec` fields, and the root-var name (`${CLAUDE_PLUGIN_ROOT}` vs
  `${PLUGIN_ROOT}`) differ by design; both configs invoke the same underlying script.

## 4. kebab-case namespacing

Every agent and skill identifier in this repo is namespaced under `neo` to avoid collisions
when this plugin sits in a marketplace alongside others.

- **Namespace prefix:** Claude Code agent identifiers and filenames carry an explicit `neo-`
  prefix (`neo-code-reviewer`, `neo-planner`, …) because Claude subagents can be invoked by bare
  name and must not collide with another plugin's `code-reviewer`.
- **kebab-case rule:** the canonical form for an identifier is lowercase words joined by
  hyphens — no underscores, no camelCase, no spaces (`code-reviewer`, `task-authoring`,
  `implementation-planner`). This applies to the role segment of an agent identifier and to
  skill names.
- **Canonical filename rule (Claude Code):** `agents/neo-<role>.md`, where `<role>` is the
  kebab-case role name and the file's frontmatter `name:` field matches the filename stem
  exactly (e.g. `agents/neo-code-reviewer.md` → `name: neo-code-reviewer`).
- **Skills are not `neo`-prefixed.** The one skill in the repo today, `task-authoring`
  (`.github/skills/task-authoring/SKILL.md`), uses a bare kebab-case name with no `neo-` prefix.
  Skill namespacing is provided by the plugin/marketplace name (`neo`) itself at install time,
  not embedded in the skill's own identifier — unlike agents, which are addressed by bare name
  within a session and so carry the prefix directly.
- **Copilot's dotted form** (`neo.<role>.agent.md`) is Copilot CLI's own agent-file convention
  (dot-separated namespace segment + a mandatory `.agent.md` suffix). The `<role>` segment
  itself stays kebab-case (`code-reviewer`, `implementation-planner`); only the separator after
  `neo` and the file suffix differ from Claude's form. See Known drift for whether this counts
  as a deviation from the kebab-case rule.

## Known drift

The following inconsistencies are real, verified against the files in this repo. They are
**documented here as drift, not corrected** — fixing them is out of scope for this spec.

### Agent filename style

- Claude Code: kebab-case, e.g. `agents/neo-code-reviewer.md`.
- Copilot CLI: dotted, e.g. `.github/agents/neo.code-reviewer.agent.md`.

Per §4, kebab-case is the namespacing rule this repo declares canonical. Copilot's dotted
`neo.<role>.agent.md` form is best read as an **accepted harness-format convention** — Copilot
CLI expects the `.agent.md` suffix and a namespace-dot separator, and the `<role>` segment
inside it *is* kebab-case (`code-reviewer`, not `codeReviewer`). It is not a violation of the
per-word kebab-case rule, but it is a second, harness-imposed identifier grammar layered on top
of the first, and the two harnesses' filenames are not byte-for-byte derivable from one another
by a simple find/replace — describing it as fully "in sync" would overstate the current state.

### `marketplace.json` `source` value mismatch

- `.claude-plugin/marketplace.json` → `"source": "./"`
- `.github/plugin/marketplace.json` → `"source": "."`

Both are intended to mean "the plugin's source is the repository root," and both harnesses
apparently accept their own spelling. There is no documented reason for the trailing-slash
difference; it is an inconsistency between the two manifests that §3 flags `source` as
harness-owned but not as a field where arbitrary spelling drift is desirable.

### Agent roster mismatch

Claude Code's `agents/` (6 files) and Copilot's `.github/agents/` (7 files) do not mirror each
other one-to-one:

| Claude Code (`agents/`) | Copilot CLI (`.github/agents/`) |
|---|---|
| `neo-code-reviewer.md` | `neo.code-reviewer.agent.md` |
| `neo-code-writer.md` | `neo.code-writer.agent.md` |
| `neo-master-control.md` | `neo.master-control.agent.md` |
| `neo-researcher.md` | `neo.researcher.agent.md` |
| `neo-technical-engineer.md` | `neo.technical-engineer.agent.md` |
| `neo-planner.md` | `neo.implementation-planner.agent.md` |
| *(none)* | `neo.task-planner.agent.md` |

Five roles (code-reviewer, code-writer, master-control, researcher, technical-engineer) mirror
cleanly, one file per harness with matching content.

The remaining two rows are where the roster actually diverges, and not quite the way a naive
file-count diff would suggest:

- **`neo-planner.md` (Claude) and `neo.implementation-planner.agent.md` (Copilot) are the same
  agent under different identifiers.** Their body text is verbatim identical ("You convert a
  spec and its research findings into an implementation plan the orchestrator can delegate unit
  by unit…"). So the **Implementation Planner** role *does* have a Claude-side file — it is
  just named `neo-planner`, not `neo-implementation-planner`, breaking the otherwise-consistent
  `neo-<role>` / `neo.<role>.agent.md` correspondence used by every other pair.
- **`neo.task-planner.agent.md` (Copilot) has no Claude-side counterpart at all.** The
  interactive Feature→Task decomposition agent that `docs/glossary.md` and
  `docs/architecture.md` call the **Task Planner** exists only under `.github/agents/`. This
  contradicts `docs/architecture.md`'s claim that the `task-planner` agent "ship[s] for GitHub
  Copilot (`.github/`) and Claude Code (`.claude/`)" — no such Claude-side file exists in this
  repo (and no `.claude/` directory exists at all; Claude subagents live in `agents/`).

Net effect: Claude's crew is 6 files covering 6 roles; Copilot's crew is 7 files covering 7
roles (the same 6, plus Task Planner) — and one of the 6 shared roles (Implementation Planner)
is named inconsistently across the two trees.
