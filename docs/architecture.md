# Neo Agentic SDLC — Architecture

Terms in **bold** are defined in the [glossary](./glossary.md).

## What neo is

neo is spec-driven development with the spec unit shrunk from feature-sized to task-sized. Traditional spec-driven development treats a whole feature as one spec — too coarse a unit of work to reason about cleanly or to validate automatically. neo keeps the business contract at the feature level and moves the _spec_ down to the **task**: bite-sized, technical, and machine-checkable.

Its second departure is one of emphasis. Spec-driven development centers the specification — but a specification is only instructions for humans and agents to follow while building code. The build is not the point; the proof is. **Specifications produce code; verification proves that code has value.** A spec that yields running code nobody needed has produced nothing. neo treats verification — the business's judgment that a feature delivers what it promised — as the work that matters, and the specification as merely the means to it.

> Spec-driven development is dead. Long live specifications and verifications.

## The core rule

**Verify features, validate tasks. Humans verify, machines validate.**

Two axes, locked together:

| Level       | Proof            | Gatekeeper               | Against               |
| ----------- | ---------------- | ------------------------ | --------------------- |
| **Feature** | **Verification** | Human (**BE**) judgment  | the business contract |
| **Task**    | **Validation**   | Machine (tests + agents) | the spec              |

Proof is authored **when the unit is defined**, at every level:

- Feature defined → verification steps authored (BE)
- Task defined → validation criteria authored (BE + `task-planner`)
- Step defined (Coding loop) → commit

You can auto-validate a task-sized spec; you cannot reliably auto-validate a feature-sized one. The unit-of-work decision (task = spec) and the proof-mechanism decision (machine validates) are the same decision viewed twice.

## Hierarchy of work

**PRD / Requirements** (segmented) → **Feature** (business, BE-signed) → **Task** (spec, ≈ 1 PR) → **Step** (≈ 1 commit).

## The three loops (Diagram 2, target end-state)

Only the Specification loop is designed today; the rest is the end-state map.

1. **Specification loop** `[designed]` — problem space → solution space. Human-gated at both ends.
2. **Coding loop** `[target]` — `Research → Implementation Planner → Implement` across Build, Validation, and Verification spaces; ends at Review → Code Review → PR.
3. **Verification / Operations** `[target]` — PR Review, Smoke Test, User Test, CD, Telemetry, run by the SRE and Platform Engineering agents.

## Specification loop in detail

### Feature definition

A feature is business-level and contains:

- **What** — a brief description.
- **Why** — justification for building it _now_.
- **KPIs** (optional) — hypotheses with a number and a window (e.g. "decrease abandoned carts by 23% over 30 days").
- **Verification steps** — business-executable in non-prod. **This is the contract.**

Entry to _ready-to-work_ requires What + Why + verification steps **and** BE sign-off. If the BE cannot verify it, it cannot deploy.

### Feature → Task decomposition

Interactive and collaborative between the **BE** and the `task-planner` agent — never autonomous. A bad split poisons everything downstream, so the agent proposes a breakdown and surfaces its uncertainty; the BE converges and approves. "Done" is a BE-approved task set, not an agent-emitted one.

- **Strategy is chosen per feature, with the BE.** Default to logical chunks (vertical slices), not stack layers. Layer-based splits are legitimate only when the change is genuinely one layer. The stack skills (React, Web API, Bicep, …) serve the Coder _inside_ a task — they are not a decomposition template.
- **Sizing: one task ≈ one PR.** Too big → split; too small (can't stand as its own PR) → fold.
- **Validation criteria are authored at task creation** and must be machine-checkable — an assertion a test or agent can run to a deterministic pass/fail.

Governed by the `neo-task-authoring` skill (what a clean task _is_) and run by the `task-planner` agent (how to _carve_). Both ship for GitHub Copilot (`.github/`).

### PRD → Feature

One step upstream of Feature→Task, and interactive with the BE in the same way: the `feature-agent` drafts What, Why, optional KPIs, and verification steps from a PRD/requirements segment, governed by the `neo-feature-authoring` skill. It stops at a BE-signed feature and hands off to `task-planner` for decomposition — it does not decompose tasks itself.

## Key decisions

- **Task = spec.** The framework's central bet: a smaller spec unit is a machine-validatable one.
- **No hand-off BA.** The BE owns intent from PRD segment through decomposition — no transcribe-and-throw-over-the-wall.
- **Proof at definition.** Verification and validation are authored when the unit is created, not retrofitted later.
- **Logical chunks over layers.** Default decomposition is vertical slices that validate independently.

## Status

- **Live:** Specification-loop design; `neo-task-authoring` skill + `task-planner` agent, and `neo-feature-authoring` skill + `feature-agent` (GitHub Copilot).
- **Target (Diagram 2, not yet specced):** Coding loop, Verification / Operations loop, and the root `AGENTS.md` backbone.

## Open threads

- **Root `AGENTS.md`** — the portable project backbone does not exist yet; neo is currently README + LICENSE only.
