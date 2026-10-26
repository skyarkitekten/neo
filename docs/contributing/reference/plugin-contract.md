# Plugin Contract Spec

Terms in **bold** are defined in the [glossary](../../glossary.md).

This is the **normative** contract for packaging this repo as plugins for **GitHub Copilot
CLI** from one source tree. It defines the monorepo layout, per-plugin folder shape, manifest
fields, and the `neo-` naming convention.

> **Single harness (issue #34).** Neo ships for GitHub Copilot CLI only. Copilot is the
> **canonical, sole source**. The Claude Code tree was dropped and deferred — a Claude mirror
> may be regenerated from the Copilot source later if there is demand. Until then this repo
> carries no `agents/`, `skills/`, `.claude/`, or `.claude-plugin/` trees, and there is no
> mirror or dual-manifest rule to maintain.

Neo is a **monorepo of plugins**. Shipped plugins live under `plugins/`; today there are two,
`plugins/neo-core/` (the coding and specification crew) and `plugins/neo-product/` (the
Product loop). The repo root holds the marketplace manifest, docs, and dev-time-only
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
│   ├── neo-core/                     # a shipped plugin (see §1 for its shape)
│   └── neo-product/                  # a shipped plugin — the Product loop
├── scripts/
│   └── validate-plugins.py           # CI: asserts each plugin's Copilot manifests + allowlists are valid
└── docs/                             # this spec, glossary, architecture, etc. — not shipped
```

**Dev-time vs shipped.** Anything under `plugins/*/` is shipped to installers. The repo-root
`.github/agents/` tree is **dev-time only** — it holds `master-control`, the agent that authors
this harness config, which is visible to Neo developers working inside the repo but never
packaged into a plugin. There is no exclusion mechanism to maintain: a role is shipped iff its
file lives under a `plugins/*/` tree.

## 1. Plugin folder shape

Each plugin under `plugins/` is a self-contained Copilot tree:

```
plugins/neo-core/
├── plugin.json                       # Copilot plugin manifest — the required file, at the plugin root
├── agents/                           # Copilot subagents — dotted neo.<role>.agent.md
├── skills/                           # Copilot Agent Skills, e.g. neo-task-authoring/SKILL.md
├── commands/                         # optional slash commands, neo-<name>.md (neo-product only today; see §4.1)
├── hooks/
│   ├── hooks.json                    # Copilot hook schema (v1, camelCase events, ${PLUGIN_ROOT})
│   └── scripts/
│       ├── log-event.sh              # observability logger, called by hooks.json
│       ├── enforce-guardrails.sh     # opt-in preToolUse enforcement (Unix), NOT wired by hooks.json
│       └── enforce-guardrails.ps1    # opt-in preToolUse enforcement (Windows/PowerShell sibling)
└── scripts/                          # plugin-local tooling, e.g. analyze_agent_logs.py
```

This is the layout Copilot CLI documents: `plugin.json` at the plugin root, with `agents/`,
`skills/`, `hooks/`, and (optionally) `commands/` beside it. **A plugin tree contains no `.github/` directory.**
`.github/` is where a *repository* keeps repo-scoped agents, skills, and hooks; a plugin's
install directory is not a repository root, so the two are different mechanisms that happen
to share folder names. Nesting plugin components under `.github/` still resolves when every
path is declared explicitly, but it buys nothing and it defeats the CLI's defaults — which is
how Neo shipped for several releases with `skills` undeclared and **every skill silently
failing to load**.

| Path (within a plugin)               | Purpose                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `plugin.json`                        | Plugin metadata (name, version, author, keywords, …) plus the `agents`/`skills`/`hooks`/`commands` paths. |
| `agents/`                            | Subagent definitions, one dotted `neo.<role>.agent.md` file per role.                            |
| `skills/`                            | Agent Skills, e.g. `neo-task-authoring/SKILL.md`.                                                |
| `commands/`                          | Optional. Slash commands, one `neo-<name>.md` file each — a short address for a skill (see [§4.1](#41-command-surfaces-for-skills)). `neo-product` ships `neo-design.md`. |
| `hooks/hooks.json`                   | Lifecycle-logging hooks, Copilot event names, `${PLUGIN_ROOT}`, versioned schema (`"version": 1`). A shipped manifest registers no fail-closed event. |
| `hooks/scripts/log-event.sh`         | The observability logger `hooks.json` shells out to (fail-open). See [observability.md](../guides/observability.md). |
| `hooks/scripts/enforce-guardrails.sh` | The opt-in `preToolUse` enforcement hook on Unix (fail-closed): blocks commit/push to `main` and non-draft PRs. Shipped but **not** wired by `hooks.json`; a consuming repo opts in. A `.ps1` sibling covers Windows. See [enforcement.md](../guides/enforcement.md). |

**No cross-plugin file references.** A plugin is copied as a self-contained directory on
install. A file under `plugins/neo-core/` cannot reference a path outside its own plugin
directory (`../neo-react/...` or a repo-root file won't be copied). Any content two plugins
need must be duplicated into each.

**A plugin has no `instructions/` slot — instruction files cannot ship.** Copilot discovers
`*.instructions.md` by *location*: the repository root, the current working directory,
intermediate directories between them, directories nested in the path of a file it is working
on, `$HOME/.copilot/instructions/`, or a directory named in `COPILOT_CUSTOM_INSTRUCTIONS_DIRS`.
A plugin's install directory is none of these, and `plugin.json` carries path keys only for
`agents`, `skills`, `hooks`, `commands`, `extensions`, `mcpServers`, and `lspServers`.
Putting an `instructions/` folder in a plugin therefore ships a directory
Copilot never reads. Instruction files are a **project-tier** artifact authored into the
consuming repo's `.github/instructions/` — see
[`stack-plugin-contract.md`](./stack-plugin-contract.md).

## 2. Manifest fields

Two things are conflated easily here, so they are separated below:

- **Spec** — what GitHub Copilot CLI itself requires or defines. Source:
  [CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference).
- **House rule** — what *Neo* additionally requires of its own plugins. Not enforced by the
  CLI. `scripts/validate-plugins.py` enforces only part of it: that the manifests parse, that
  declared `agents`/`skills`/`commands`/`hooks` paths resolve (inside the plugin, and non-empty) and
  that existing component directories are declared, that each marketplace `plugins[].source`
  resolves and its `version` matches that plugin's `plugin.json`, and that no marketplace
  entry declares component paths — plus hooks and agent-frontmatter checks. The remaining
  house rules (required identity fields, `keywords[]`, `metadata.*`) are held by review.

Per the spec, **`name` is the only required field in `plugin.json`.** Everything else is
optional. Neo requires more because a shipped plugin with no author, license, or description
is a poor artifact — but that is Neo's rule, not Copilot's, and an external plugin that omits
them is still valid.

### 2.1 A plugin's `plugin.json`

`plugin.json` lives at the **plugin root**. Literal values below are transcribed from
`plugins/neo-core/`; `plugins/neo-product/` carries the same fields with its own values.

| Field         | Value                                            | Spec        | House rule                       |
| ------------- | ------------------------------------------------ | ----------- | -------------------------------- |
| `name`        | `"neo-core"`                                     | Required.   | Kebab-case, `neo-` prefixed.     |
| `version`     | semver string                                    | Optional.   | Required. Each plugin versions independently. |
| `description` | present ("… Copilot CLI manifest")               | Optional.   | Required.                        |
| `author.name` | `"Chad Thomas"`                                  | Optional.   | Required.                        |
| `homepage`    | `"https://github.com/skyarkitekten/neo"`         | Optional.   | Required.                        |
| `repository`  | `"https://github.com/skyarkitekten/neo"`         | Optional.   | Required.                        |
| `license`     | `"MIT"`                                          | Optional.   | Required.                        |
| `keywords[]`  | string array, chosen per plugin (see §3.1)       | Optional.   | Required.                        |
| `agents`      | `"agents/"`                                      | Optional; defaults to `agents/`. | Required — declared explicitly even though it matches the default. |
| `skills`      | `"skills/"`                                      | Optional; defaults to `skills/`. | Required — declared explicitly even though it matches the default. |
| `hooks`       | `"hooks/hooks.json"`                             | Optional; no default. | Required whenever the plugin ships hooks. |
| `commands`    | `"commands/"` (`neo-product` only)               | Optional; no default. | Required whenever the plugin ships commands. |

**Why declare paths that match the default.** Relying on an implicit default is what hid the
skills bug: the key was simply absent, so nothing looked wrong in review. Declaring every
component the plugin has — `agents`, `skills`, `hooks`, and `commands` when a `commands/`
directory exists — makes the contract legible in the manifest itself and gives the validator something to check
against the filesystem.

### 2.2 Root `.github/plugin/marketplace.json`

The marketplace manifest stays at the repo root and lists each shipped plugin under `plugins[]`.
Unlike a plugin tree, this file *is* repo-scoped, so `.github/plugin/` is the right home for it.

| Field                   | Value                                 | Status                                    |
| ----------------------- | ------------------------------------- | ----------------------------------------- |
| `name` (top-level)      | `"neo"`                               | Required — the marketplace name.          |
| `owner.name`            | `"skyarkitekten"`                     | Required.                                  |
| `metadata.description`  | present                               | Required.                                  |
| `metadata.version`      | semver string                         | Required.                                  |
| `plugins[].name`        | `"neo-core"`, `"neo-product"`         | Required — one entry per shipped plugin.   |
| `plugins[].source`      | `"plugins/neo-core"`                  | Required — repo-root-relative path.        |
| `plugins[].description` | present                               | Required.                                  |
| `plugins[].version`     | semver, matching that plugin's `plugin.json` | Required.                           |
| `plugins[].author.name` | `"Chad Thomas"`                       | Required.                                  |
| `plugins[].license`     | `"MIT"`                               | Required.                                  |
| `plugins[].keywords[]`  | string array, chosen per plugin (see §3.1) | Required.                             |

**Do not declare `agents`, `skills`, `commands`, or `hooks` here.** Component paths in a marketplace entry
are *inert* when the plugin source ships its own `plugin.json` — which every Neo plugin does.
Verified against Copilot CLI 1.0.81:

| Path declared by                            | Skills loaded |
| ------------------------------------------- | ------------- |
| marketplace entry only                       | **0**         |
| plugin's own `plugin.json`                   | 3             |
| marketplace entry, declaring a *false* path  | 3 (ignored)   |

The CLI resolves `source` → reads that plugin's `plugin.json` → loads components from there.
A copy in the marketplace entry changes nothing but reads as live configuration, so someone
debugging a path problem can edit it, see no effect, and lose an afternoon. One source of
truth: the plugin's own manifest.

**`source` rule:** write the repo-root-relative path to the plugin directory
(`"plugins/neo-core"`). The spec notes a leading `./` is unnecessary; Neo omits it.

## 3. How Copilot loads the plugin

Copilot CLI reads the root `.github/plugin/marketplace.json` → resolves each plugin's `source`
→ reads that plugin's `plugin.json` → agents from `agents/`, skills from `skills/`, slash
commands from `commands/` (when declared; there is no default), hooks from `hooks/hooks.json`
(Copilot v1 schema, `${PLUGIN_ROOT}`).

**Keep components at the default paths.** A declared non-default path is honored on a direct
install (`copilot plugin install ./plugins/neo-core`) but did *not* load when the same plugin
was installed through a marketplace entry — tested at `custom-skills/` against CLI 1.0.81,
declared in `plugin.json`, zero skills loaded. Components sitting at `agents/` and `skills/`
are the only arrangement observed to work in both modes. This is inferred from reported skill
counts rather than CLI source, so treat the mechanism as provisional and the guidance as firm:
put components at the default paths, and declare them anyway.

**Verify, don't assume.** A component path that resolves to nothing is not an error — the CLI
loads the plugin and contributes nothing from that slot. The only reliable check is to install
the plugin and inspect what actually loaded:

```bash
export COPILOT_HOME=$(mktemp -d)
copilot plugin marketplace add .      # must run from the repo root
copilot plugin install neo-core@neo   # reports "Installed N skills."
copilot plugin list                   # confirms installed, enabled, and live directory
copilot -p "List the exact names of every skill available to you and nothing else."
```

`copilot plugins list --kind skill --scope plugin` is unreliable on CLI 1.0.81 — it prints
`No plugins found.` even when the skills installed and are loading correctly, so it is not a
valid substitute for the checks above. The direct-install form
(`copilot plugin install ./plugins/neo-core`) is also deprecated as of 1.0.81; prefer the
marketplace form shown here except when specifically testing non-default component paths.

Every shipped plugin must carry its Copilot `plugin.json` and `hooks.json`; a missing or
invalid manifest breaks the plugin. `scripts/validate-plugins.py` enforces that both parse.

The **hook manifest + script contract** — the schema, the per-shell `${PLUGIN_ROOT}` rule
(`$env:PLUGIN_ROOT` in PowerShell), and the stdin/`{"continue":true}` script contract — is
owned by [`hook-contract.md`](./hook-contract.md).

### 3.1 What must stay consistent

- `name` — `"neo"` (marketplace top-level) and the per-plugin names (`"neo-core"`,
  `"neo-product"`).
- `version` — a plugin's `plugin.json` and its `plugins[].version` entry in the marketplace
  must agree. Plugins version **independently** of each other and of `metadata.version`, so
  `neo-core` and `neo-product` are expected to sit at different numbers. Both are bumped
  together automatically after a merge to `main` that touches `plugins/**`:
  `.github/workflows/version-bump.yml` opens a PR from `scripts/bump-versions.py`, which
  derives the bump level from the Conventional Commit types of the commits that touched that
  plugin's directory (`!`/`BREAKING CHANGE` → major, `feat` → minor, anything else → patch),
  skipping `chore(release)` commits; a plugin no commit touched is not bumped. It does not
  touch `metadata.version`.
- `license`, `author.name` / `owner.name` — identity describes one project.
- `keywords[]` — kept meaningful per manifest.
- `plugins[].source` — the repo-root-relative path to the plugin directory (e.g.
  `plugins/neo-core`, no `./` prefix).

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
- **An optional domain segment** is permitted where a plugin groups agents by discipline:
  `neo.<domain>.<role>.agent.md` (e.g. `neo.design.ux.agent.md`, `neo.product.coach.agent.md`).
  Both segments stay kebab-case. Use it only when the plugin has two or more domains; a
  single-domain plugin like `neo-core` stays on the flat `neo.<role>` form.
- **`name:` is the display identity**, always `Neo <Role>`. It need not be a mechanical
  transform of the filename, but must unambiguously identify the same agent. The `Neo ` prefix
  is what prevents collisions in a shared marketplace, so it is never omitted.
- **No provenance keys in agent frontmatter.** Agent frontmatter has no free-form metadata slot,
  so keys outside the documented set (`neo-version:`, `phase:`, and the like) are tolerated by
  today's parsers rather than supported, and break silently if that changes. A plugin's version
  lives in its `plugin.json`; workflow stage belongs in the agent's prose. Skills are different:
  the Agent Skills spec defines a `metadata:` map for exactly this, alongside `name`,
  `description`, `license`, `compatibility`, and `allowed-tools` — and on spec-conformant
  packaging paths any *other* top-level key is a hard error, not an ignored field.
- **Command files:** `commands/neo-<name>.md`. The filename is the bare slash command, so the
  `neo-` prefix lives in the filename. See [§4.1](#41-command-surfaces-for-skills).
- **Copilot skill directory:** `skills/neo-<name>/SKILL.md`, and the frontmatter `name:`
  matches the directory name (e.g. `skills/neo-feature-authoring/SKILL.md` →
  `name: neo-feature-authoring`).

Copilot resolves delegated agents by their frontmatter `name:` field, not the filename, so an
agent's `agents:` allowlist must reference real `name:` values. `scripts/validate-plugins.py`
walks every `plugins/*/` and fails CI on any allowlist entry that doesn't resolve.

### Vendored skills

Neo-authored skills carry the `neo-` prefix. A skill **vendored** from an upstream source keeps
its upstream name unchanged (no `neo-` prefix), since its identity is owned elsewhere. Neither
shipped plugin vendors a skill today; every current skill is Neo-authored. `neo-core` ships
`neo-evidence-standard`, `neo-feature-authoring`, and `neo-task-authoring`; `neo-product` ships
`neo-design-thinking`, `neo-evidence-standard`, `neo-product-requirements`, and
`neo-systems-thinking`. `neo-evidence-standard` is duplicated into both plugins, because
plugins can't share files (see [§1](#1-plugin-folder-shape), "No cross-plugin file
references"). The per-plugin inventory lives in
[`stack-plugin-contract.md` § What ships](./stack-plugin-contract.md#what-ships).

### 4.1 Command surfaces for skills

**Decision (issue #90).** A skill that owns several activities gets a deterministic,
sub-command address. The skill keeps its canonical `neo-<name>` identifier, and the plugin may
add a **short slash command** — a `commands/neo-<short>.md` file — that does nothing but hand
its arguments to that skill. `neo-product` ships the first one, `/neo-design <activity>`, for
`neo-design-thinking`. The short name is still `neo-` prefixed; an unprefixed `/design` is not
shipped. This is option (b) from issue #90 (an alias layer over the canonical skill), in its
namespaced form, so the §4 prefix rule needs no exception.

**Evidence: Copilot CLI has a declarative command mechanism, and no skill-alias field.**

- `FACT` — A legacy `plugin.json` accepts `commands`, "Path(s) to command directories", with no
  default ([CLI plugin reference § Component path fields](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference#component-path-fields),
  fetched 2026-10-21).
- `FACT` — "Commands are an alternative to skills stored as individual `.md` files … The command
  name is derived from the filename. Command files use a simplified format (no `name` field
  required) and support `argument-hint`, `description`, `allowed-tools`, and
  `disable-model-invocation`. Commands have lower priority than skills with the same name."
  ([CLI command reference § Commands (alternative skill format)](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#commands-alternative-skill-format),
  fetched 2026-10-21).
- `FACT` — The skill frontmatter fields are `name`, `description`, `argument-hint`,
  `allowed-tools`, `user-invocable`, and `disable-model-invocation`; a skill is invoked as
  `/SKILL-NAME`. There is **no alias field** — a skill has exactly one slash name (same page,
  § Skill frontmatter fields).
- `FACT` — "When two plugins provide skills with the same name, both coexist using
  plugin-qualified invocation names such as `/my-plugin/search` … This applies to skills only;
  commands keep the standard tier-based deduplication, where the higher-priority source wins."
  (same page, § Skill locations).
- `FACT` — Probed on Copilot CLI 1.0.102 with a throwaway plugin declaring `"commands":
  "commands/"` in a throwaway `COPILOT_HOME`: `copilot -p "/neo-probe draft scope"` ran the
  command file and the model received `draft scope` (multi-token arguments arrive intact);
  `/neo-probe` alone received no arguments; a command body saying "invoke the `neo-probe-skill`
  skill" loaded and ran that plugin skill with the arguments. Placeholders in the command body
  (`$ARGUMENTS`, `$1`, `{{args}}`) were **not** substituted — the arguments travel in the user
  message, so a command body must refer to them in prose, not by placeholder.

**Why namespaced, not `/design`.** Skills that collide fall back to a plugin-qualified name;
commands do not — the higher-priority source wins and the other is unreachable. An unprefixed
`/design` (or `/prd`) is a likely collision in a shared marketplace, so it would either shadow
another plugin's command or be shadowed by one, with no way back to ours. `/neo-design` keeps
§4's guarantee. The canonical skill form, `/neo-design-thinking <activity>`, always works too.
A user who wants the bare `/design` can add a personal skill or command of that name; at
personal scope it is their own choice to make, not one a shipped plugin makes for them.
`scripts/validate-plugins.py` fails any command file not named `neo-<name>.md`.

**The mechanism, which every Neo Product skill reuses.** It is designed once here; the
`neo-systems-thinking` (#91) and `neo-product-requirements` (#92) issues apply it rather than
redesigning it. Both issues were filed with unprefixed `/systems` and `/prd`; under this
contract they ship namespaced as `/neo-systems` and `/neo-prd`, and each issue's examples and
acceptance criteria read with that prefix. Their sub-command names remain theirs to settle.

1. **One shim, no logic.** The command file names the canonical skill, passes the user's
   arguments verbatim, and sets `disable-model-invocation: true` so the model only ever
   auto-loads the skill itself. All resolution lives in the skill's `## Commands` section, so the
   short command and the canonical skill behave identically.
2. **A Commands table** in the skill with three required columns — **canonical command**,
   **aliases**, and **reference** (a human label such as "Activity" or "Phase" may sit beside
   them). The canonical command is chosen for the user to type; it does **not** have to equal the
   reference file's stem. `neo-design-thinking` happens to use the stems (`journey-mapping` →
   `journey-mapping.md`); #91 proposes `causal-loop` → `causal-loop-mapping.md` and #92 proposes
   `scope` → `scope-definition.md`. Listing the stem as an alias where it differs is optional —
   a skill may do it so the long form resolves, but the short command and its documented aliases
   are sufficient. Every name — canonical or alias, on every axis — is
   lowercase kebab-case and unique within the skill. Matching is case-insensitive and exact.
3. **No argument → menu plus one recommendation**, derived from the artifacts already on disk.
   Never auto-run.
4. **Resolution is exhaustive and ordered.** Every argument string lands in exactly one of
   these, tried in order; nothing falls through to a default by accident:
   1. *No arguments* → the menu (point 3).
   2. *First word is an exact canonical command or alias* → direct dispatch to that reference.
   3. *First word is a near-miss of a name* (a single word, or a hyphenated first word, within
      two single-character edits of a name, differing only by a trailing `s`, or a prefix of one
      at least four characters long) → the menu with the nearest match called out. Never guess.
   4. *A single unrecognised word* → natural-language routing **only** if it clearly matches
      exactly one of the skill's existing triggers (say which activity it routed to);
      otherwise the menu, with the nearest match if there is one. A single word **never**
      reaches the skill's fallback/default activity.
   5. *A multi-word request that reads as a description of the work* (a phrase about users, a
      product, an experience, a system, or a problem) → the skill's existing natural-language
      routing, unchanged, including any default it already has. A short command-like phrase
      whose first word is not a name (`audit all`) is not a description: show the menu.
5. **Prose arguments → the skill's existing natural-language routing**, unchanged, within the
   bounds of point 4. Direct dispatch is additive.
6. **Preconditions always run, and the skill tells the user it ran them.** A sub-command skips
   trigger matching only — never a pre-flight, a required prior artifact, or a non-negotiable
   principle. "Run the precondition, and say what it found" is the default shape.
7. **Multi-axis skills use `[mode] <topic> [context…]`.** A single-axis skill has one table and
   treats every word after the command as context for the activity. A skill with a second axis
   (#92: Draft / Review / Coach over eight PRD topics) adds a separate **Modes** table of
   canonical mode, aliases, and behavior, and parses positionally:
   - **Precedence.** A mode is recognised only in the **first** position. Words after the topic
     are context, never re-parsed as a mode or a second topic. Mode and topic names must be
     disjoint; should a collision ever ship, the first word resolves as a **topic**, because the
     topic is what users name.
   - `/neo-prd draft scope` — first word is a mode, second is a topic → explicit mode, direct
     dispatch to the topic's reference.
   - `/neo-prd scope` — first word is a topic → the mode is **inferred** exactly as the skill
     infers it today. If inference is ambiguous, **ask** which mode, listing them; never default
     silently.
   - `/neo-prd draft` — a mode with no topic → the topic menu with that mode retained. Mode-only
     invocation never auto-runs a topic.
   - `/neo-prd draft scoep` — a mode then an unknown or near-miss second word → the topic menu
     with the mode retained and the nearest topic called out (point 4 applied to the second
     position).
   - An unknown or near-miss **first** word is checked against both tables; the nearest match is
     reported from whichever table holds it.

   The probe above confirms multi-token arguments reach the skill intact.
8. **Sub-command names are a public surface.** Adding an activity or alias is safe; renaming or
   removing one is breaking — keep the old name as an alias.
