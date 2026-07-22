# Stack Plugin Contract — the core/stack split

Terms in **bold** are defined in the [glossary](../glossary.md).

This is the **normative** design for how neo is decomposed into distributable plugins: what
`neo-core` owns, what a stack plugin (`neo-react`, `neo-dotnet`, …) adds, and the contract
between them. It governs *which tier a rule belongs to* and *how stack skills are discovered at
runtime*.

It is the companion to [`plugin-contract.md`](./plugin-contract.md), which owns the mechanical
shape — folder layout, manifest fields, `neo-` naming. This doc owns the *split*: the tiers, the
late-binding rule, and the skill-description discovery format. When the two overlap, the
mechanical facts (paths, manifest keys) are `plugin-contract.md`'s; the design rationale is here.

> **Copilot-only (issue #34).** neo ships for GitHub Copilot CLI only. The dual-harness design
> that first motivated this split — a Claude Code mirror, dual manifests, a `validate-mirrors.py`
> check — was dropped. The pre-#34 reasoning, including the executed migration plan, is preserved
> as historical context in [`../archive/packaging.md`](../archive/packaging.md). This document is
> the live contract.

---

## Decisions

| # | Decision |
| --- | --- |
| 1 | **Monorepo.** One repo, one marketplace, many plugins. |
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

Every rule in the system belongs to exactly one tier. A rule living one tier away from where it
belongs is the repo's characteristic defect.

| Tier | Owns | Ships as | Varies by |
| --- | --- | --- | --- |
| **Process** | Loops, roles, proof mechanisms, orchestration, observability | `neo-core` | Nothing — identical everywhere |
| **Technology** | How to build, test, and review in a given stack | `neo-react`, `neo-dotnet`, … | Stack |
| **Project** | Layout, exact commands, integration mode, gotchas | Consuming repo's `AGENTS.md` | Project |

**Test for placement:** if it changes when you switch stacks, it isn't core. If it changes when
you switch projects within the same stack, it isn't the stack plugin either — it belongs in the
consuming repo's `AGENTS.md`.

**The project tier is the consumer's obligation.** `neo-core` ships no `AGENTS.md` and no template
for one — neo ships capability, not scaffolding. Every project installing `neo-core` must author
its own, because the core agents treat it as the source of truth for commands, layout, and style.
Without it the crew does not error — it runs, and the build-and-test gate self-corrects against
nothing. **This failure is silent**, so `neo-core` must state the requirement at install time
rather than assume it.

---

## What ships

| Artifact | Ships in | Notes |
| --- | --- | --- |
| `technical-engineer` (orchestrator) | `neo-core` | |
| `researcher` | `neo-core` | |
| `implementation-planner` | `neo-core` | |
| `code-writer` | `neo-core` | Selects stack skills by description, never a hardcoded list |
| `code-reviewer` | `neo-core` | Same |
| `feature-agent` | `neo-core` | |
| `task-planner` | `neo-core` | |
| `neo-feature-authoring` skill | `neo-core` | |
| `neo-task-authoring` skill | `neo-core` | |
| Lifecycle hooks + `log-event.sh` | `neo-core` | |
| `analyze_agent_logs.py` | `neo-core` | Analyzes logs the core hooks emit — ships with them |
| **`master-control`** | **nothing** | Dev-time only |
| Stack skills (React, xUnit, Bicep, …) | `neo-<stack>` | Mostly not yet authored |

---

## master-control is not a runtime agent

`master-control` authors agents, skills, instruction files, hooks, and `AGENTS.md` files. It
participates in none of the three loops — it is the prompt used to *build* neo. It lives at the
repo root (`.github/agents/neo.master-control.agent.md`), which Copilot CLI auto-discovers for
anyone working *inside* this repo, while the plugin's agent path points at
`plugins/neo-core/.github/agents/`. So it is visible to neo developers and invisible to
installers, with no exclusion mechanism to maintain: a role is shipped iff its file lives under a
`plugins/*/` tree.

The repo file is the **canonical** authoring prompt. If it is mirrored anywhere else (e.g. a
Claude project's custom instructions), that copy is regenerated from the repo file, never the
reverse — versioned, reviewable, and diffable wins.

---

## Stack plugin contract

### Skills-first, but not skills-only

A stack plugin ships skills by default. It **may** ship more when a stack genuinely requires it
(decision 3). But treat a stack that wants its own *agent* as a signal, not a routine extension:
the loop shape is the IP, and a stack-specific agent means either the core role is mis-specified
or the work belongs in a skill. Require a written justification in the plugin's README before
adding one. Loops stay the same across stacks; that invariant is what makes `neo-core` worth
having.

### The late-binding rule

`neo-core` agents **cannot name stack skills** — the stack may not be installed. They must select
skills by *description matching*, never by name. `code-writer` states the correct rule:

> If a skill exists for the framework, library, or file type you're touching, prefer it over
> improvising. If none matches, proceed with the conventions in `AGENTS.md`.

Core agents therefore carry no hardcoded stack-skill lists.

### Skill description format — the discovery contract

Late binding puts the entire discovery burden on stack-skill descriptions. Skills load by
progressive disclosure: the agent sees only `name` + `description` until something matches. A
stack skill with a vague description **silently never loads**, and the coder improvises while
appearing to work correctly. This failure is undetectable at runtime, so it is the one to design
against.

Every stack skill must:

1. **Open with "Use when…"** — phrase as trigger conditions, not a capability description.
2. **Name concrete file triggers** — extensions (`.tsx`, `.csproj`, `.bicep`), and directory or
   filename conventions where they exist.
3. **Name the technology explicitly** — framework, library, and runtime by the names that appear
   in a task description.
4. **State the phase it serves** — implement, test, or review. Build-time skills (React, Angular,
   Web API, Bicep) are distinct from test-time skills (xUnit, Playwright); the description must
   make that distinction discoverable.
5. **Not overload** — one capability per skill, so the description stays sharp. A skill covering
   "React and testing and deployment" triggers wrongly in all three cases.

Bad: `React skill — helps with React code.`
Good: `Use when writing or reviewing React components — .tsx/.jsx files, hooks, component state,
props, or context. Implementation-phase skill; see the testing skill for component tests.`

This format ships as a `neo-stack-skill-authoring` skill in `neo-core`, so the contract is
enforceable by the same mechanism as `neo-task-authoring` and `neo-feature-authoring`. It cannot
be a shared file stack plugins import — [no cross-plugin file references](./plugin-contract.md#1-plugin-folder-shape)
means the core↔stack contract has to be documentation plus an in-core skill, not a shared schema.

### Skill naming

`neo-` naming is owned by [`plugin-contract.md` § 4](./plugin-contract.md#4-neo--naming). The
design reason it matters here:

| Skill origin | Name | Example |
| --- | --- | --- |
| **Authored by neo** | `neo-` prefix | `neo-task-authoring`, `neo-react-components` |
| **Vendored from another plugin** | Keep the upstream name unchanged | `react-hooks` |

Bare skill names resolve by precedence, and Copilot ranks plugin skills near the **bottom** of its
load order — every project-local and personal skill location outranks them. So an unprefixed
`react` skill in `neo-react` is **silently shadowed** by any same-named skill in the consuming
repo: no error, no warning, and the agent loads someone else's instructions while appearing to
work. The `neo-` prefix costs nothing (core agents select by description, not name) and buys
shadowing protection.

Vendored skills keep their upstream name to preserve provenance — renaming diverges them from
upstream and turns re-syncing into a manual diff. Accept the collision risk explicitly and record
it in the skill's `PROVENANCE.md`; rename a specific skill only if it proves collision-prone in
practice.

### Third-party skill sourcing

Many stack skills are vendored rather than authored here (decision 4).

**Scope: other coding-agent plugins only** — `SKILL.md` files and their bundled `scripts/`,
`references/`, `assets/`. Not general OSS libraries, application code, or anything that becomes a
runtime dependency. neo vendors *instructions*, not software. A `SKILL.md` is still a copyrighted
work.

**Provenance.** Every vendored skill carries a `PROVENANCE.md` recording: upstream repo URL,
license, version or commit SHA, date vendored, and **every local modification made**. Without the
last field, no one can tell neo's adaptations from upstream behavior, and re-syncing becomes
guesswork.

**License compatibility.** neo is MIT; vendoring is redistribution, so the upstream license must
permit it:

| License | Vendor? |
| --- | --- |
| MIT, Apache-2.0, BSD, CC0, CC-BY | Yes — with attribution as the license requires |
| CC-BY-SA, GPL family | No — copyleft terms conflict with MIT redistribution |
| Non-commercial (CC-BY-NC) | No — clients are commercial |
| No license stated | No — absence of a license means no grant of rights |

The last row catches the common case: a useful `SKILL.md` in an unlicensed GitHub repo is **not**
free to vendor. Ask upstream or write your own.

**Staleness.** A vendored skill is a fork the moment it lands and goes stale silently. Decide a
re-sync cadence per skill and record it in `PROVENANCE.md`.

**Alternative: reference, don't vendor.** Where an upstream skill is well-maintained and separately
installable, the stack plugin can document it as a recommended companion install rather than
copying it — avoiding the staleness and licensing burden at the cost of a multi-step install.
Prefer this where the upstream is healthy.

---

## Open questions

**Who authors the consuming repo's `AGENTS.md`?** With `master-control` undeployed, no shipped
artifact writes it — yet `neo-core` depends on it for commands, layout, and the integration mode.
Options: (a) the neo team runs `master-control` during client onboarding as a service; (b)
`neo-core` ships a thin setup skill that interviews the user and writes it; (c) it's documented as
a manual prerequisite.

**Stack plugin ↔ core version compatibility.** `neo-react` will assume core agent roles and skill
contracts that may change. Copilot's plugin entry fields (`name`, `source`, `version`, `agents`,
`skills`, `hooks`, `mcpServers`, `lspServers`, `strict`) include no dependency field, so a
`neo-react` requires `neo-core >= x` constraint is likely a documented convention plus a runtime
check, not a manifest feature. To confirm.
