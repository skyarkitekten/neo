---
name: neo-task-authoring
description: Use when writing or reviewing a task during Feature→Task decomposition. Defines the required task fields, how to write machine-checkable validation criteria, and the one-PR sizing rule that bounds a task. Load whenever proposing, editing, or checking a task's shape.
---

# Authoring a clean task

A task is the spec-level unit of work. It derives from exactly one signed-off feature and must stand on its own as a single pull request.

## Required fields

- **Title** — imperative and specific (`Add checkout POST endpoint`, not `Checkout work`).
- **Parent feature** — link/id of the one feature this task derives from. Every task traces to a feature; no orphans.
- **What** — the technical change, in enough detail that a Coder needs no further business input.
- **Validation criteria** — the machine-checkable proof the task is complete. Authored now, at task creation. See below.

Do not author steps or commits here. A task is broken into steps inside the Coding loop; each step becomes one commit. Decomposition stops at the task.

## Validation criteria — the rules

Validation is machine-executed (unit tests, system tests, autonomous agents). No criterion may require human judgment — that is *verification*, and it lives at the feature, not the task.

Each criterion must be:

- **Executable without a human** — a test or agent runs it and gets a deterministic result.
- **Pass/fail** — no "looks right", no "seems fast enough".
- **An observable outcome** — assert behavior, not implementation.
- **Tied to the What** — it proves this task's change, nothing broader.

Before / after:

- ✗ `The checkout form works and looks clean.` (needs a human; not observable)
- ✓ `POST /api/checkout with a valid card returns 201 and creates an Order row with status=paid.` (a system test asserts this)

If you cannot express a criterion the machine can check, the task is under-specified — sharpen the What or split the task.

## Sizing — the one-PR rule

A task is correctly sized when it would land as **one coherent, reviewable pull request**.

- **Too big** (spans multiple PRs' worth of change, or mixes unrelated concerns) → split into multiple tasks.
- **Too small** (cannot stand as its own PR, has no independently validatable outcome) → fold into a sibling.

A task must be **independently validatable**: its criteria pass or fail on their own, not contingent on a sibling shipping first beyond declared ordering.

**"One PR" here is a unit of measure, not a merge destination.** This rule governs how big a task is — nothing more. Where the resulting PR *targets*, and what can be reverted atomically afterward, is a separate project-level decision (the **integration mode**) and is not yours to make during decomposition. Size tasks identically under either mode.

## Integration mode — not your call

The project chooses one of two integration modes. Both preserve one-task-one-PR; they differ only in what the PR targets.

- **Mode A (neo default)** — each task PRs into a long-lived **feature branch**; the feature branch squash-merges to the default branch once verified.
- **Mode B** — each task PRs directly to the **default branch** behind a feature flag.

You do not select the mode, and your task shapes should not vary by it. Two things follow for decomposition:

- **Do not author a task whose only purpose is integration plumbing** — merging, flag creation, or branch mechanics. That is the mode's job, not a unit of work.
- **Under Mode B, flag-gating is not a task.** If the project runs Mode B, gating is a standing implementation convention for every task under a feature, not a separate task you carve.

If you cannot tell which mode is in effect and it changes what you would propose, **ask the BE** rather than assuming. See `docs/process-flow.md` § Integration modes.

## Shape, not layers

A task is a coherent logical unit — typically a vertical slice of behavior that cuts through whatever layers it needs. Do **not** shape tasks around stack layers by default (a "React task", an "API task", a "DB task"); layer-shaped tasks usually can't validate independently. Layer-based tasks are legitimate only when the change genuinely is one layer (a shared library, pure infra). The stack skills (React, Web API, Bicep, etc.) serve the Coder *inside* a task — they are not a decomposition template.

## Template

```
Title:
Parent feature:
What:
Validation criteria:
  - <machine-checkable statement>
  - <machine-checkable statement>
```
