# Filing work

The one page both operators and integrators touch: **what a well-formed unit of work looks like**
before it enters the pipeline. It's the user-facing companion to the normative
[task-handoff schema](../contributing/reference/task-handoff-schema.md) — read that when you need the
exact fields; read this when you need to know *how to hand work in*.

Terms in **bold** are in the [glossary](../glossary.md).

## Two units, two bars

neo works with two units. They enter at different points and clear different gates.

| Unit | What it is | Gate to pass | Who signs |
| --- | --- | --- | --- |
| **Feature** | Business intent: What / Why / KPIs / verification steps | Verifiable in non-prod by the BE | Human (**BE**) |
| **Task** | The spec: one feature's slice, ≈ 1 PR, machine-checkable | Task-authoring conformance + BE-approved set | Human (**BE**) |

## Filing a Feature

A **Feature** is the contract. Give it:

- **What** — a brief description of the change.
- **Why** — justification for building it *now*.
- **KPIs** (optional) — a hypothesis with a number and a window (e.g. "decrease abandoned carts by
  23% over 30 days").
- **Verification steps** — business-executable in a non-prod environment. **This is the contract.**
  If you can't verify it, it can't deploy.

A feature is *ready to work* only with What + Why + verification steps **and** BE sign-off. The
**Neo Feature Agent** drafts this with you; see [using-neo.md](./using-neo.md).

## Filing a Task

A **Task** is what the orchestrator consumes. It is filed as its carrier — **a Task *is* the GitHub
Issue or Azure DevOps story** it lives in, not a separate document. A well-formed Task:

- **Derives from exactly one Feature.** No orphan tasks; no task spanning two features.
- **Is sized to ≈ one pull request.** Too big → split. Too small to stand as its own PR → fold.
- **Carries machine-checkable validation criteria** — each an assertion a test or agent can run to a
  deterministic pass/fail. Not "looks right"; a check that passes or fails.
- **Is a logical chunk** — a vertical slice that validates independently, not a stack layer (unless
  the change genuinely is one layer).

The **Neo Task Planner** produces these with you; the exact field list and on-harness serialization
are owned by the [task-handoff schema](../contributing/reference/task-handoff-schema.md).

## Why the bar is where it is

Validation criteria are authored **at task creation**, not bolted on later, because the whole point
of shrinking the spec to task grain is that a task-sized spec is one a machine can validate. A task
you can't express a pass/fail check for is too big or too vague — split it or sharpen it. The
rationale is in [architecture.md](../concepts/architecture.md); the loop boundary this handoff
crosses is [process-flow.md § Boundary 1](../concepts/process-flow.md).

## Common mistakes

- **Vague verification.** "Users can log in" isn't a step; "In staging, a new user completes signup
  and sees the dashboard" is.
- **Task with no feature.** Every task must trace to one signed feature — that's what keeps intent
  from being laundered.
- **Layer-split by default.** Splitting into front-end/back-end/db tasks usually produces slices
  that can't validate alone. Prefer vertical slices.
- **Deferred validation.** If you're planning to "add tests later," the task isn't ready.
