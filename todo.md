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

Since no template ships, the carrier is `master-control` — it authors consuming repos'
`AGENTS.md` files. **Add a rule to `master-control` requiring the integration mode be stated
when it authors an `AGENTS.md` for a project running neo**, and to ask the BE if it isn't
already declared. Mirror to both harness trees.

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

## Lower priority / open

- `.github/copilot-hooks.template.json` is superseded by `.github/hooks/hooks.json`; README
  already calls it "the older, hand-wired hook example." Delete it or state why it stays.
- `.gitignore` ignores `*.jsonl` repo-wide — broader than the `.agent-logs/` intent.
- Open items already tracked in `docs/neo-user-manual-outline.md` § 8 (pin skill names, trim
  `jq` field paths in `log-event.sh`, confirm Copilot hook schema) overlap this list —
  reconcile into one source of truth rather than two.
