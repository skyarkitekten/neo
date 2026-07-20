# todo

Findings from a full read of the repo (2026-07-19). Ordered by severity. Not yet triaged or scheduled.

---

## 1. Copilot orchestrator lacks the tools its body requires

`.github/agents/neo.technical-engineer.agent.md` declares `tools: ['search']`, but its
procedure requires creating a feature branch (phase 3) and opening a draft PR (phase 5).
No `runCommands`, no git/github tooling. Phases 3 and 5 cannot execute.

The Claude mirror (`agents/neo-technical-engineer.md`) has `Bash, Task` and is fine.

**Fix:** grant the Copilot orchestrator the tools for branch + PR, or narrow its documented
scope to research/plan only and say so in the body.

## 2. Broken `agents:` allowlist entry

Same file: `agents: ['Neo Researcher', ...]`. The researcher's actual frontmatter `name:` is
**`Neo Researcher Agent`** (`.github/agents/neo.researcher.agent.md`). The name doesn't match,
so delegation to the researcher won't route.

**Fix:** reconcile — either drop `Agent` from the researcher's `name`, or correct the
allowlist. Prefer the former; every other agent's name is `Neo <Role>`.

## 3. The two agent trees have diverged

| Agent | `.github/agents/` (Copilot) | `agents/` (Claude) |
| --- | --- | --- |
| code-reviewer | ✅ | ✅ |
| code-writer | ✅ | ✅ |
| feature-agent | ✅ | ✅ |
| implementation-planner | ✅ | ❌ — still named `neo-planner.md` |
| master-control | ✅ | ✅ |
| researcher | ✅ | ✅ |
| task-planner | ✅ | ❌ **missing entirely** |
| technical-engineer | ✅ | ✅ |

The Implementation Planner rename (commit `4a1a9c6`) landed only on the Copilot side.
`docs/plugin-contract.md` § "Known drift → Agent roster mismatch" already documents this.

**Fix:** mirror `neo.task-planner.agent.md` → `agents/neo-task-planner.md`; rename
`agents/neo-planner.md` → `agents/neo-implementation-planner.md` and update its `name:`.
Then clear the entry from Known drift.

## 4. Skills ship Copilot-only

`task-authoring` and `feature-authoring` live in `.github/skills/`. There is no top-level
`skills/` tree, and `.claude-plugin/plugin.json` declares no skills path.

But the Claude-side agents instruct: *"Load it. Do not restate its rules here; conform to
them."* On Claude Code those skills don't exist, so `neo-feature-agent` and the (missing)
task-planner would run with their governing rules absent.

**Fix:** decide — mirror skills to a top-level `skills/` and declare them in
`.claude-plugin/plugin.json`, or make the Claude-side agents self-contained. Mirroring is
consistent with the dual-manifest rule in `docs/plugin-contract.md`.

## 5. Root `AGENTS.md` is irrelevant in its current form — replace it

> **Chad is writing neo's own `AGENTS.md` (2026-07-19).** The template can be deleted once it
> lands. See § 5a for the separate consumer-side requirement.

**Ruled (Chad, 2026-07-19):** this repo is *not* a React/.NET application. It is a
distribution repo — a collection of agents, skills, instructions, and hooks shipped as
plugins for two harnesses. The current `AGENTS.md` is the unfilled React/Bun + .NET 10
template, TODO block intact, and describes a repo that doesn't exist here.

This is live misdirection, not just dead weight: every agent points to `AGENTS.md` as "the
source of truth for commands, layout, and style," so an agent working *inside* neo is told to
run `bun run test` against a tree of markdown, bash, and python.

**Fix:** write a real `AGENTS.md` describing neo itself. It should cover:

- **Layout** — the dual agent trees (`.github/agents/` Copilot, `agents/` Claude), the dual
  manifests, the dual hook configs, `.github/skills/`, `docs/`.
- **The mirror rule** — most artifacts exist twice, once per harness. Editing one without the
  other is the repo's characteristic defect (see § 3, § 4). State it as a hard rule up top.
- **Naming** — `neo.<role>.agent.md` vs `neo-<role>.md`, kebab-case, skills unprefixed. All
  normative in `docs/plugin-contract.md` — point there, don't restate.
- **Checks that actually exist here** — JSON manifest validity, frontmatter validity, the
  two trees in sync. There is no build; don't invent one.
- **Gotchas** — `docs/plugin-contract.md` is the normative contract; `docs/glossary.md` owns
  vocabulary; don't restate rules across files.

**Delete the template — do not relocate it.** *Ruled (Chad, 2026-07-19):* neo will not ship a
React/.NET `AGENTS.md` template. Neo ships **capability** — plugins that help users build
React or .NET applications — not **project scaffolding**.

The consuming repo's `AGENTS.md` is the user's own artifact, and neo already has the right
answer for how it gets written: `master-control` authors `AGENTS.md` files. Neo ships the
agent that writes one, not a pre-baked file to copy. Nothing to move to `assets/` or
`templates/`; `git rm` it once neo's own `AGENTS.md` exists.

## 5a. Consumers of `neo-core` must create an `AGENTS.md` in their project repo

Distinct from § 5, which is neo's own file. This is the **consuming repo's** `AGENTS.md` —
the project tier in `docs/packaging.md`.

**It is a hard prerequisite, not a nice-to-have.** Every core agent treats `AGENTS.md` as
"the source of truth for commands, layout, and style." Install `neo-core` into a repo without
one and:

- `code-writer` has no build, lint, or test commands to run — so the build-and-test gate, the
  highest-value line in the whole system, silently does nothing.
- `code-reviewer` is told to judge against `AGENTS.md` and has nothing to judge against.
- The integration mode (§ 15) has nowhere to be declared.

None of that errors. The crew runs, produces plausible output, and self-corrects against
nothing. **Absence fails quietly** — which is why it has to be stated loudly at install time.

**What the consuming repo's `AGENTS.md` must carry, at minimum:**

- Layout — where the code lives.
- Exact runnable commands — install, build, lint, test, per layer.
- Enforceable style rules.
- The finish gate — run tests and lint, fix failures.
- Hard constraints up top (e.g. never commit to `main`).
- The **integration mode** — Mode A or Mode B (`docs/process-flow.md`).
- Gotchas an agent can't infer — env vars, codegen steps, generated paths not to edit.

**Where to say so.** Decide the carrier:

- `neo-core`'s README and plugin `description` — cheapest, easily ignored.
- A `sessionStart` hook that warns when no `AGENTS.md` is found — noisy but effective, and
  turns a silent failure into a visible one.
- A setup skill in `neo-core` that interviews the user and writes the file — most helpful,
  most work, and overlaps the open question in `docs/packaging.md` about who authors it.

Not mutually exclusive; the hook plus the README is probably the right floor.

## 6. No `preToolUse` / `PreToolUse` hook exists

`neo-technical-engineer`, `AGENTS.md`, and the manual outline all state that never-commit-to-
`main` "must also be enforced at the harness level (via permissions or a `preToolUse` hook) —
don't treat this line as the safeguard."

Neither `hooks/hooks.json` (Claude) nor `.github/hooks/hooks.json` (Copilot) registers a
pre-tool event. The enforcement those files promise doesn't exist.

**Fix:** write the block-on-`main` hook for both harnesses. Mind the exit-code divergence —
Copilot denies on any non-zero except `2`; Claude Code blocks on `2`.

## 7. README is stale

- Names agents that don't exist: `orchestrator`, `planner`. Actual roster is in § 3 above.
- Links `docs/manual-outline.md`; the file is `docs/neo-user-manual-outline.md`.
- References invoking "the **business engineer**" — no agent by that name. BE is a *human
  role* per `docs/glossary.md`; the agents a BE drives are `feature-agent` and `task-planner`.

## 8. `docs/architecture.md` contradicts the repo

Its Status / Open threads sections say the root `AGENTS.md` "does not exist yet; neo is
currently README + LICENSE only." It exists, as do agents, skills, hooks, and manifests.

## 9. Uncommitted work sitting on `main`

Untracked: `.github/agents/neo.feature-agent.agent.md`, `.github/skills/feature-authoring/`,
`agents/neo-feature-agent.md`. Modified: `docs/architecture.md`, `docs/glossary.md`,
`docs/plugin-contract.md`.

All on `main`, against the project's own rule. Move to a feature branch.

## 10. Verify model names in `master-control`

`agents/neo-master-control.md` and its Copilot mirror recommend `Claude Sonnet 4`,
`GPT-5.6`, `kimi-k2.7-code`, `GPT-4.1`, `GPT-4.1-mini`. These are cited as "per the Copilot
learning hub" but unverified. An agent will act on this list.

**Fix:** verify against current Copilot docs, or replace the specific names with selection
*criteria* so the guidance can't go stale.

---

## 11. Task vs. Issue/story — no defined carrier across Boundary 1

`neo-technical-engineer` declares its input as "a GitHub Issue or Azure DevOps story." The
Specification loop emits a **Task**. These are described as two artifacts but must be one:
a neo Task should *be* the issue/story it's filed as.

Until stated, the Specification→Coding handoff has no defined carrier. See
`docs/process-flow.md` § Boundary 1.

**Resolved (2026-07-20):** the carrier is now fixed in `docs/task-handoff-schema.md` § 1 —
one Task = one GitHub Issue = one Azure DevOps story.

## 12. `Testing` phase modeled two different ways

Diagram 2 draws `Testing` as its own Coding-loop phase after `Implement`. But
`neo.implementation-planner` emits test units *interleaved* with feature units, and
`neo-code-writer` implements whichever it's assigned.

**Fix:** pick one model — phase-separated testing or interleaved labeled units — before
speccing the Coding loop internals. See `docs/process-flow.md` § Boundary 2.

## 13. Diagram 2 sub-box is mislabeled

The expanded sub-box reads "Specification Loop" but contains the Coding loop phases
(Research → Planner → Implement → Testing → Review → PR, under Team Leader). Fix in the
source diagram before it propagates into the docs.

## 14. `feature-authoring` skill needs the falsifiability gate

`.github/skills/feature-authoring/SKILL.md` currently says KPIs are optional and to "omit
rather than invent one with no credible basis." Credible is now testable — a KPI is
admissible only if the BE can name the metric, the instrumentation, the window, and the
falsifier. See `docs/process-flow.md` § Falsifiability is a gate on KPI authoring.

Two consequences to fold into the skill:

- **Instrumentation is in scope.** If the telemetry that would settle the KPI doesn't exist
  yet, emitting it is part of the feature. A KPI whose instrumentation never shipped is
  unsettleable and silently breaks the Operations→Specification edge.
- **Captive-population rule.** For internal LOB apps, engagement metrics (adoption, DAU,
  session length) are invalid evidence, not weak evidence — they measure compulsion. Require
  outcome metrics, and require a baseline/holdout designed at feature-definition time.

Also mirror to the Claude side once § 4 (skills ship Copilot-only) is resolved.

## 15. Integration mode needs a home in project config

`docs/process-flow.md` § Integration modes defines Mode A (default) and Mode B, and
`task-authoring` now tells the task-planner to ask the BE when the mode is unclear. But
nothing declares which mode a project is running.

**Fix:** pick where the mode is stated — most likely a line in the **consuming repo's** root
`AGENTS.md`, since both harnesses read it every turn. Then have `task-authoring` point at
that location instead of "ask the BE."

Note the distinction sharpened by § 5: this is the *consuming* repo's `AGENTS.md`, not neo's
own. Neo's `AGENTS.md` describes how to work on neo; the integration mode is a fact about the
project neo is deployed into.

~~Since no template ships, the carrier is `master-control`.~~ **Superseded 2026-07-19:**
master-control is not deployed — it's the authoring prompt for building neo, not a runtime
agent (see `docs/packaging.md`). So no shipped artifact authors the consuming repo's
`AGENTS.md`, and this item is blocked on that gap.

**Blocked on:** who authors the consuming repo's `AGENTS.md`? Options in
`docs/packaging.md` § Open questions — neo-team-as-a-service, a thin setup skill in
`neo-core`, or a documented manual prerequisite. Whichever wins becomes the carrier for the
integration-mode declaration.

## 16. Mode A obligations are unenforced

Mode A carries three obligations that currently exist only as prose in `process-flow.md`:

- Feature branches refreshed from the default branch to limit drift.
- Non-prod deployable from an arbitrary feature branch.
- Squash commit body carries child task IDs + parent feature ID (audit traceability).

The third is a good `preToolUse` / pre-merge hook candidate — reject a squash merge whose
body has no task IDs. Folds into § 6 (no pre-tool hook exists).

## 17. Agents load stack skills that don't exist

`neo-code-writer.md` and its Copilot mirror instruct: *"Primary skills for this repo: **React**
— component structure, hooks, state. **TypeScript** — types, strictness, idioms. **.NET / C#**
— API patterns, async, DI."* `neo-code-reviewer.md` names the same three.
`neo-master-control.md` tells the author to "read the relevant skill so the rules you write
match how work is actually done here."

**None of these skills exist.** `.github/skills/` contains exactly two: `feature-authoring`
and `task-authoring`. Both are process skills. There is no stack skill anywhere in the repo.

So every agent in the crew is told to load skills that ship nowhere — the same dangling-
reference class as § 3 and § 4, but pointing at artifacts that were never written rather than
ones that drifted.

**This is the product roadmap, not just a bug.** Per Chad (2026-07-19), what neo ships is
capability: plugins that help users build React or .NET applications. Diagram 2 already names
the intended set — **React, Angular, Web API, Bicep** on the Implement coders, and **xUnit,
Playwright** on the Testing coders.

**Fix, in order:**

1. Short term — soften the agent bodies so they say *load whatever stack skill is available*
   rather than naming three that don't exist. Removes the dangling reference without blocking
   on authoring six skills.
2. Medium term — author the stack skills. `master-control` is the agent for this.
3. Decide packaging: one `neo` plugin containing everything, or a core plugin plus per-stack
   plugins (`neo-react`, `neo-dotnet`) users install selectively. The second matches "we ship
   plugins that help users build React or .NET applications" more literally and keeps context
   budget down for users who need only one stack.

Item 3 is a real fork and should be settled before authoring, since it changes the manifest
layout in `docs/plugin-contract.md`.

## 18. Execute the core/stack split

Design is done — `docs/packaging.md` has the target layout, the core↔stack contract, and a
file-by-file move table. **Files have not moved.**

Prerequisites, all in that doc:

- ~~Verify nested `"source": "./plugins/neo-core"` works in both marketplace formats.~~
  **Done 2026-07-19 — supported by both.** Always write the `./` prefix: Claude requires it,
  Copilot doesn't care.
- ~~Settle skill prefixing.~~ **Done 2026-07-19 — neo-authored skills take a `neo-` prefix;
  vendored skills keep their upstream name.** Plugin skills rank near the bottom of Copilot's
  load order, so an unprefixed skill is silently shadowed by any same-named project or
  personal skill. Requires renaming `task-authoring` → `neo-task-authoring` and
  `feature-authoring` → `neo-feature-authoring` during the move, plus every reference to them.
  Supersedes the rule in `docs/plugin-contract.md`.
- Write neo's own `AGENTS.md` (§ 5) first, so the repo is never without one. **In progress —
  Chad.** Last remaining blocker.

**Constraint discovered during verification:** plugins cannot reference files outside their
own directory — `../neo-core/...` won't be copied on install. Each plugin is a self-contained
copy; shared content must be duplicated or symlinked. This forecloses sharing files between
core and stacks.

Executing this resolves § 3, § 4, § 5, § 17, and the superseded hooks template as a side
effect. Fold them in during the move rather than fixing them first.

## 19. master-control exists in two places and will drift

`agents/neo-master-control.md` (plus its Copilot mirror) is substantially the same text as
the Claude project custom instructions used to author this repo. Two copies in two different
systems, no sync mechanism, and drift is invisible because they're never seen side by side.

**Fix:** declare the repo file canonical — it's versioned, diffable, and reviewable — and
regenerate the project instructions from it. State the rule in neo's `AGENTS.md`.

## 20. Add a mirror-drift check to CI

Nearly every defect on this list is one harness tree edited without the other. The core/stack
split multiplies the surface: every shipped plugin carries two manifests, two agent trees, and
two skill trees.

**Fix:** `scripts/validate-mirrors.py` asserting each shipped plugin's Copilot and Claude
trees hold matching artifacts; wire into CI. Makes the mirror invariant executable instead of
aspirational, and pays for itself immediately given § 3 and § 4.

**Treat a missing Copilot manifest as an error, not a warning.** Copilot's manifest resolution
falls back to `.claude-plugin/plugin.json`, so a plugin missing its Copilot manifest still
*installs* — then resolves to Claude-format agents it can't read. It fails silently. The
harness won't catch this, so the check must.

## Lower priority / open

- `.github/copilot-hooks.template.json` is superseded by `.github/hooks/hooks.json`; README
  already calls it "the older, hand-wired hook example." Delete it or state why it stays.
- `.gitignore` ignores `*.jsonl` repo-wide — broader than the `.agent-logs/` intent.
- Open items already tracked in `docs/neo-user-manual-outline.md` § 8 (pin skill names, trim
  `jq` field paths in `log-event.sh`, confirm Copilot hook schema) overlap this list —
  reconcile into one source of truth rather than two.
