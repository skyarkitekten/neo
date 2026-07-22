# Packaging — the core/stack split (ARCHIVED)

> **📦 Archived — historical context only.** This is the pre-#34 dual-harness packaging design.
> Its migration plan has since been executed (the monorepo of plugins exists) and its Claude /
> mirror content was dropped when neo went Copilot-only (#34). **The live design moved to
> [`../reference/stack-plugin-contract.md`](../reference/stack-plugin-contract.md)** (tiers,
> core/stack split, stack-skill discovery) and the normative mechanical contract is
> [`../reference/plugin-contract.md`](../reference/plugin-contract.md). Read this file only to
> understand how the split was originally reasoned out; do not treat it as current.

How neo is decomposed into distributable plugins, what ships, what doesn't, and the contract
between the core harness and the stack plugins that extend it.

**Status:** design. No files have been moved. The migration plan at the end is a plan, not a
changelog.

> **⚠️ Partly superseded by issue #34 (Copilot-only).** This document was written when neo
> shipped for two harnesses. As of #34 the repo is **GitHub Copilot CLI only** — the Claude
> Code tree (`agents/`, `skills/`, `hooks/hooks.json`, `.claude-plugin/`, `.claude/`) and the
> dual-manifest / mirror rule described below were dropped. Copilot is the canonical, sole
> source; a Claude mirror may be *generated* from it later if there is demand. Read the Claude
> and mirror passages below as historical design context, not the current contract. The live,
> normative contract is [`plugin-contract.md`](../reference/plugin-contract.md); the mirror check is now
> `scripts/validate-plugins.py` (Copilot-only), not `validate-mirrors.py`.

---

## Decisions

Recorded 2026-07-19.

| # | Decision |
| --- | --- |
| 1 | **Monorepo.** One repo, one marketplace per harness, many plugins. |
| 2 | **`neo-core` + one plugin per stack.** Every project installs `neo-core`; stacks are additive. |
| 3 | **Stacks are generally skills, but not restricted to skills.** The IP is the harness; skills are what plug into it. |
| 4 | **Many stack skills will be sourced from third-party OSS**, not authored here. |
| 5 | **`master-control` stays in the repo and is not deployed.** It is the authoring prompt for building neo, not a runtime agent. |

Example installs:

```
all projects          neo-core
projects 1, 2, 5      neo-core + neo-react + neo-dotnet
projects 3, 4         neo-core + neo-python + neo-agent-framework
project 6             neo-core + neo-rust
```

---

## The three tiers

Every rule in the system belongs to exactly one tier. Most defects logged in
[`todo.md`](../../todo.md) are tier violations — a rule living one tier away from where it
belongs.

| Tier | Owns | Ships as | Varies by |
| --- | --- | --- | --- |
| **Process** | Loops, roles, proof mechanisms, orchestration, observability | `neo-core` | Nothing — identical everywhere |
| **Technology** | How to build, test, and review in a given stack | `neo-react`, `neo-dotnet`, … | Stack |
| **Project** | Layout, exact commands, integration mode, gotchas | Consuming repo's `AGENTS.md` | Project |

**Test for placement:** if it changes when you switch stacks, it isn't core. If it changes
when you switch projects within the same stack, it isn't the stack plugin either — it belongs
in the consuming repo's `AGENTS.md`.

**The project tier is the consumer's obligation.** `neo-core` ships no `AGENTS.md` and no
template for one (decision: neo ships capability, not scaffolding). Every project installing
`neo-core` must author its own, because the core agents treat it as the source of truth for
commands, layout, and style.

Without it the crew does not error — it runs, and the build-and-test gate self-corrects
against nothing. **This failure is silent**, so `neo-core` must state the requirement at
install time rather than assume it. See `todo.md` § 5a for the minimum contents and the
options for how to enforce it.

The current root `AGENTS.md` (React/Bun + .NET template) is project-tier content sitting in
the process-tier repo. `code-writer`'s hardcoded "Primary skills: React, TypeScript, .NET/C#"
is technology-tier content sitting in a process-tier agent. Same error, twice.

---

## Repo layout (target)

```
neo/
├── AGENTS.md                          # neo's own — how to work on THIS repo
├── README.md
├── todo.md
│
├── .claude-plugin/
│   └── marketplace.json               # Claude marketplace — lists every plugin
├── .github/
│   ├── plugin/
│   │   └── marketplace.json           # Copilot marketplace — lists every plugin
│   └── agents/
│       └── neo.master-control.agent.md    # DEV-TIME ONLY — not shipped
├── .claude/
│   └── agents/
│       └── neo-master-control.md          # DEV-TIME ONLY — Claude mirror
│
├── plugins/
│   ├── neo-core/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── .github/plugin/plugin.json
│   │   ├── agents/                    # Claude subagent format
│   │   ├── .github/agents/            # Copilot *.agent.md format
│   │   ├── skills/                    # Claude skills
│   │   ├── .github/skills/            # Copilot skills
│   │   ├── hooks/hooks.json           # Claude
│   │   ├── .github/hooks/hooks.json   # Copilot
│   │   ├── .agent-hooks/log-event.sh
│   │   └── scripts/analyze_agent_logs.py
│   ├── neo-react/
│   ├── neo-dotnet/
│   └── neo-<stack>/
│
└── docs/                              # repo docs — not shipped
```

**The master-control placement is load-bearing and free.** Copilot CLI auto-discovers
repo-root `.github/agents/` for anyone working *inside* this repo, while the plugin's agent
path points at `plugins/neo-core/.github/agents/`. So leaving master-control at the repo root
makes it available to neo developers and invisible to installers — with no exclusion
mechanism, no manifest flag, nothing to maintain. The rule that falls out:

> **Repo-root `.github/agents/` and `.claude/agents/` are dev-time. `plugins/*/` is shipped.**

Note the Claude-side path differs: Claude Code reads dev-time subagents from `.claude/agents/`,
not `agents/`. The master-control Claude mirror moves there, not to the repo-root `agents/`
directory (which disappears entirely).

---

## What ships

| Artifact | Ships in | Notes |
| --- | --- | --- |
| `technical-engineer` (orchestrator) | `neo-core` | |
| `researcher` | `neo-core` | |
| `implementation-planner` | `neo-core` | |
| `code-writer` | `neo-core` | Hardcoded stack-skill list must be removed |
| `code-reviewer` | `neo-core` | Same |
| `feature-agent` | `neo-core` | |
| `task-planner` | `neo-core` | |
| `feature-authoring` skill | `neo-core` | |
| `task-authoring` skill | `neo-core` | |
| Lifecycle hooks + `log-event.sh` | `neo-core` | |
| `preToolUse` enforcement + `enforce-guardrails.sh`/`.ps1` | `neo-core` | Blocks push/commit to `main` and non-draft PRs, cross-platform — see `docs/guides/enforcement.md` |
| `analyze_agent_logs.py` | `neo-core` | Analyzes logs the core hooks emit — ships with them |
| **`master-control`** | **nothing** | Dev-time only |
| Stack skills (React, xUnit, Bicep, …) | `neo-<stack>` | Mostly not yet authored |

---

## master-control is not a runtime agent

`master-control` authors agents, skills, instruction files, hooks, and `AGENTS.md` files. It
participates in none of the three loops. It is the prompt used to *build* neo, and it is
substantially the same text as the Claude project instructions currently used to author this
repo.

**Consequence — one source of truth is already violated, across a boundary.** The same
authoring prompt exists in two places: `agents/neo-master-control.md` in the repo, and the
Claude project custom instructions. They will drift, and the drift is invisible because the
two live in different systems.

Pick a canonical home. The repo file is the better candidate — it is versioned, reviewable,
and diffable, and the project instructions can be regenerated from it. Whatever is chosen,
state it in neo's `AGENTS.md`.

**Consequence — the consuming repo's `AGENTS.md` now has no author.** Earlier reasoning
(`todo.md` § 15) assumed `master-control` would write it at the customer site. If
master-control never ships, that assumption is dead. Open question below.

---

## Stack plugin contract

### Skills-first, but not skills-only

A stack plugin ships skills by default. It **may** ship more when a stack genuinely requires
it — that door stays open per decision 3.

But treat a stack that wants its own *agent* as a signal, not a routine extension: the loop
shape is the IP, and a stack-specific agent means either the core role is mis-specified or the
work belongs in a skill. Require a written justification in the plugin's README before adding
one. Loops stay the same across stacks; that invariant is what makes `neo-core` worth having.

### The late-binding rule

`neo-core` agents cannot name stack skills — the stack may not be installed. They must select
skills by *description matching*, never by name.

The core agents are **already written correctly** for this. `code-writer` ends with:

> If a skill exists for the framework, library, or file type you're touching, prefer it over
> improvising. If none matches, proceed with the conventions in `AGENTS.md`.

That is the correct rule. The only defect is the hardcoded list bolted on above it. **Deleting
the list is the whole fix** — no rewording, no softening. Same for `code-reviewer`.

### Skill description format — the discovery contract

Late binding puts the entire discovery burden on stack-skill descriptions. Skills load by
progressive disclosure: the agent sees only `name` + `description` until something matches. A
stack skill with a vague description **silently never loads**, and the coder improvises while
appearing to work correctly. This is the failure mode to design against — it is undetectable
at runtime.

`neo-core` therefore publishes a required description format. Every stack skill must:

1. **Open with "Use when…"** — phrase as trigger conditions, not capability description.
2. **Name concrete file triggers** — extensions (`.tsx`, `.csproj`, `.bicep`), and directory
   or filename conventions where they exist.
3. **Name the technology explicitly** — framework, library, and runtime by the names that
   appear in a task description.
4. **State the phase it serves** — implement, test, or review. Diagram 2 separates build-time
   skills (React, Angular, Web API, Bicep) from test-time skills (xUnit, Playwright); the
   description must make that distinction discoverable.
5. **Not overload** — one capability per skill, so the description stays sharp. A skill
   covering "React and testing and deployment" triggers wrongly in all three cases.

Bad: `React skill — helps with React code.`
Good: `Use when writing or reviewing React components — .tsx/.jsx files, hooks, component state, props, or context. Implementation-phase skill; see the testing skill for component tests.`

This format should ship as a `stack-skill-authoring` skill in `neo-core`, so the contract is
enforceable by the same mechanism as `task-authoring` and `feature-authoring`.

### Skill naming

**Decided 2026-07-19. Supersedes `docs/plugin-contract.md` § kebab-case namespacing, which
currently rules that skills are not `neo`-prefixed.**

| Skill origin | Name | Example |
| --- | --- | --- |
| **Authored by neo** | `neo-` prefix | `neo-task-authoring`, `neo-react-components` |
| **Vendored from another plugin** | Keep the upstream name unchanged | `react-hooks` |

#### Why prefix at all, when both harnesses namespace

Both harnesses support plugin-qualified invocation — Claude Code as `neo-core:neo-task-authoring`,
Copilot as `/neo-core/neo-task-authoring` — which makes the prefix look redundant. It isn't,
because **bare names still resolve silently by precedence.**

Copilot deduplicates skills by the `name` field inside `SKILL.md`, first-found-wins, and its
load order ranks plugin skills near the **bottom**:

```
project .github/skills/  →  project .agents/skills/  →  project .claude/skills/
  →  inherited parents  →  ~/.copilot/skills/  →  ~/.agents/skills/
  →  PLUGIN skills/  →  custom dirs
```

Every project-local and personal skill location outranks plugin skills. So an unprefixed
`react` skill in `neo-react` is **silently shadowed** by any same-named skill in the consuming
repo — no error, no warning, and the agent loads someone else's instructions while appearing
to work correctly.

The prefix costs neo nothing functionally: core agents select skills by *description*, never
by name (see the late-binding rule above). The name's only jobs are the `/command` surface and
collision avoidance. So prefixing buys shadowing protection at purely aesthetic cost.

#### Why vendored skills keep their upstream name

Renaming a vendored skill diverges it from upstream, which makes re-syncing a manual diff
rather than a comparison, and obscures what neo did and didn't change. Provenance is worth
more than consistency here.

**Accept the collision risk explicitly:** a vendored skill can be shadowed by a project-local
skill of the same name. Record that exposure in the skill's `PROVENANCE.md` so it's a known
risk rather than a surprise. If a specific vendored skill proves collision-prone in practice,
rename it *then* and note the deviation — don't pre-emptively rename the whole set.

#### Consequences

- Rename `task-authoring` → `neo-task-authoring` and `feature-authoring` →
  `neo-feature-authoring` **during the migration**. Free now; renaming after publication
  breaks installs.
- Update every reference to those names — `neo.task-planner.agent.md`,
  `neo.feature-agent.agent.md`, their Claude mirrors, `docs/architecture.md`,
  `docs/glossary.md`, and `docs/plugin-contract.md`.
- The `stack-skill-authoring` skill becomes `neo-stack-skill-authoring`, and its published
  description format must require the `neo-` prefix for stack skills neo authors.

### Third-party skill sourcing

Many stack skills will be vendored rather than authored here (decision 4).

**Scope: other coding-agent plugins only.** This means skills, agents, and hook configs from
other agent-harness plugin repos — `SKILL.md` files and their bundled `scripts/`,
`references/`, `assets/`. It does not extend to general OSS libraries, application code, or
anything that becomes a runtime dependency. Neo vendors *instructions*, not software.

That keeps the surface narrow — the artifacts are markdown and small helper scripts — but it
does not remove the obligations below. A `SKILL.md` is still a copyrighted work.

**Provenance.** Every vendored skill carries a `PROVENANCE.md` in its folder recording:
upstream repo URL, license, version or commit SHA, date vendored, and **every local
modification made**. Without the last field, the next person cannot tell neo's adaptations
from upstream behavior, and re-syncing becomes guesswork.

**License compatibility.** Neo is MIT. Vendoring is a redistribution, so the upstream license
must permit it:

| License | Vendor? |
| --- | --- |
| MIT, Apache-2.0, BSD, CC0, CC-BY | Yes — with attribution as the license requires |
| CC-BY-SA, GPL family | No — copyleft terms conflict with MIT redistribution |
| Non-commercial (CC-BY-NC) | No — clients are commercial |
| No license stated | No — absence of a license means no grant of rights |

That last row catches the common case: a useful `SKILL.md` in an unlicensed GitHub repo is
**not** free to vendor. Ask upstream or write your own.

**Staleness.** A vendored skill is a fork the moment it lands and goes stale silently. Decide
a re-sync cadence per skill and record it in `PROVENANCE.md`. This is a real maintenance cost
and should factor into vendor-vs-author decisions.

**Alternative: reference, don't vendor.** Where an upstream skill is well-maintained and
separately installable, the stack plugin can document it as a recommended companion install
rather than copying it. Avoids the staleness and licensing burden entirely, at the cost of a
multi-step install. Worth preferring where the upstream is healthy.

---

## Open questions

**Who authors the consuming repo's `AGENTS.md`?** With master-control undeployed, no shipped
artifact writes it — yet `neo-core` depends on it for commands, layout, and the integration
mode. Options: (a) the neo team runs master-control during client onboarding as a service;
(b) `neo-core` ships a thin setup skill that interviews the user and writes it; (c) it's
documented as a manual prerequisite. This blocks `todo.md` § 15, which assumed master-control
would be present.

**~~Skill name collisions.~~** **Decided 2026-07-19.** See
[Skill naming](#skill-naming) below. Supersedes the current rule in
`docs/plugin-contract.md`, which must be updated.

**~~Does the marketplace format support nested plugin sources?~~** **Verified 2026-07-19 —
yes, both harnesses.** See [Format verification](#format-verification) below.

**Stack plugin ↔ core version compatibility.** `neo-react` will assume core agent roles and
skill contracts that may change. Neither manifest format obviously supports declaring a
dependency on another plugin's version. Determine whether that's expressible or must be a
documented convention.

---

## Format verification

Verified against both harnesses' current docs, 2026-07-19.

### Nested plugin sources — supported by both

The monorepo layout is valid. Both formats take a relative path in each `plugins[]` entry's
`source` field, resolved from the **marketplace repo root** — not from the `.claude-plugin/`
or `.github/plugin/` directory the manifest sits in.

Copilot's own documentation uses exactly this shape:

```json
{
  "name": "frontend-design",
  "version": "2.1.0",
  "source": "./plugins/frontend-design"
}
```

**Portability rule: always write the `./` prefix.** Claude Code *requires* relative sources to
start with `./`. Copilot treats it as optional (`"./plugins/x"` and `"plugins/x"` resolve
identically). Writing `./` satisfies both; omitting it breaks Claude.

### Constraint: no cross-plugin file references

**A plugin cannot reference files outside its own directory.** Paths like
`../neo-core/skills/shared.md` will not be copied on install and will break at runtime. Claude
Code's documented workaround is symlinks.

This is a hard constraint on the split, and it forecloses the obvious DRY instinct: `neo-react`
cannot read anything out of `plugins/neo-core/`. Each plugin is a self-contained copy.

Consequences to accept up front:

- **Shared content must be duplicated or symlinked.** Prefer duplication for small things;
  symlinks work but add a class of breakage on checkout across platforms.
- **The core↔stack contract has to be *documentation*, not shared files.** The stack-skill
  description format can't be a file stack plugins import — it's a rule they conform to,
  enforced by review or by `validate-mirrors.py`. This is why the discovery contract is specced
  as prose plus a `stack-skill-authoring` skill *inside core*, rather than a shared schema.

### Manifest resolution order — a footgun

Copilot checks manifest locations in order: `.plugin/plugin.json`, `plugin.json`,
`.github/plugin/plugin.json`, then **`.claude-plugin/plugin.json`**. Marketplace resolution
follows the same pattern.

So a plugin shipping only Claude manifests still *installs* on Copilot — it just resolves to
Claude-format agents, which Copilot cannot read correctly. **It fails silently rather than
loudly.** Any plugin that omits its Copilot manifest will appear to install and then
misbehave. The mirror check should treat a missing Copilot manifest as an error, not a
warning, precisely because the harness won't.

### Not yet verified

- **Cross-plugin version dependencies.** Neither format obviously expresses "`neo-react`
  requires `neo-core` >= x". Copilot's plugin entry fields (`name`, `source`, `version`,
  `agents`, `skills`, `hooks`, `mcpServers`, `lspServers`, `strict`) include no dependency
  field. Likely a documented convention plus a runtime check, not a manifest feature.
- **Whether Copilot's `strict` flag matters here.** Defaults to `true`, requiring full schema
  conformance. Worth confirming the current manifests pass strict validation before adding
  more of them.

---

## Migration plan

**Do not execute yet.** Two prerequisites remain.

### Prerequisites

1. ~~Confirm nested `source` paths work in both marketplace formats.~~ **Done — verified
   above.**
2. ~~Settle the skill-prefix question.~~ **Done — see [Skill naming](#skill-naming).**
3. Write neo's own `AGENTS.md` (`todo.md` § 5). **In progress — Chad.** Last remaining
   blocker.

### Move table

| From | To | Note |
| --- | --- | --- |
| `.github/agents/neo.{code-reviewer,code-writer,feature-agent,implementation-planner,researcher,task-planner,technical-engineer}.agent.md` | `plugins/neo-core/.github/agents/` | 7 files |
| `.github/agents/neo.master-control.agent.md` | *stays* | Dev-time |
| `agents/neo-{code-reviewer,code-writer,feature-agent,researcher,technical-engineer}.md` | `plugins/neo-core/agents/` | 5 files |
| `agents/neo-planner.md` | `plugins/neo-core/agents/neo-implementation-planner.md` | **Rename + update `name:`** (§ 3) |
| *(new)* | `plugins/neo-core/agents/neo-task-planner.md` | **Missing mirror** (§ 3) |
| `agents/neo-master-control.md` | `.claude/agents/neo-master-control.md` | Dev-time; note the path change |
| `.github/skills/{feature,task}-authoring/` | `plugins/neo-core/.github/skills/neo-{feature,task}-authoring/` | **Rename — `neo-` prefix.** Update `name:` frontmatter and every reference |
| *(new)* | `plugins/neo-core/skills/neo-{feature,task}-authoring/` | **Missing Claude mirror** (§ 4) |
| *(new)* | `plugins/neo-core/skills/neo-stack-skill-authoring/` | New — the discovery contract |
| `hooks/hooks.json` | `plugins/neo-core/hooks/hooks.json` | Update `${CLAUDE_PLUGIN_ROOT}` paths |
| `.github/hooks/hooks.json` | `plugins/neo-core/.github/hooks/hooks.json` | Update `${PLUGIN_ROOT}` paths |
| `.agent-hooks/log-event.sh` | `plugins/neo-core/.agent-hooks/log-event.sh` | |
| `scripts/analyze_agent_logs.py` | `plugins/neo-core/scripts/` | |
| `.claude-plugin/plugin.json` | `plugins/neo-core/.claude-plugin/plugin.json` | Rename plugin `neo` → `neo-core` |
| `.github/plugin/plugin.json` | `plugins/neo-core/.github/plugin/plugin.json` | Same |
| `.claude-plugin/marketplace.json` | *stays, rewritten* | Multi-plugin `plugins[]` |
| `.github/plugin/marketplace.json` | *stays, rewritten* | Same |
| `.github/copilot-hooks.template.json` | **delete** | Superseded |
| `AGENTS.md` | **delete, replace** | Template out, neo's own in |

### Sequencing

1. Write neo's own `AGENTS.md` at the root.
2. Create `plugins/neo-core/`; move core artifacts per the table.
3. Fix the known drift **during** the move, not before — the files are in motion anyway:
   rename the planner, create the two missing Claude mirrors, delete the superseded hooks
   template.
4. Rewrite both `plugin.json` files as `neo-core`; rewrite both `marketplace.json` files for
   multi-plugin.
5. Update `${PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_ROOT}` paths in both hook configs.
6. Delete the root `AGENTS.md` template.
7. Strip the hardcoded stack-skill lists from `code-writer` and `code-reviewer`.
8. Update `docs/plugin-contract.md` for multi-plugin layout — it currently specs a single
   plugin at repo root and becomes wrong the moment step 2 lands.
9. Update `README.md` — already stale, and the install instructions change.
10. Create one stack plugin as a proving case before authoring more.

### Resolved for free by this restructure

`todo.md` § 3 (agent roster drift), § 4 (skills Copilot-only), § 5 (`AGENTS.md`), § 17
(dangling stack-skill references), and the superseded hooks template. Doing the moves without
folding these in wastes the opportunity.

### Add a mirror check

Mirror drift is this repo's characteristic defect, and the split multiplies it — every plugin
carries two manifests, two agent trees, two skill trees. Add `scripts/validate-mirrors.py` to
assert that each shipped plugin's Copilot and Claude trees contain matching artifacts, and
wire it into CI. Cheaper than catching it in review each time, and it makes the invariant
executable rather than aspirational.
