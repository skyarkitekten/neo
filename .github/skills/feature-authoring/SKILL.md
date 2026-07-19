---
name: feature-authoring
description: Use when writing or reviewing a Feature during PRD-segment→Feature definition. Defines the required fields (What, Why, optional KPIs, verification steps), the human-executable verification-steps format, and the BE sign-off gate. Load whenever proposing, editing, or checking a feature's shape.
---

# Authoring a clean feature

A feature is the business-level unit of work. It derives from a PRD/requirements segment and is **the contract** the whole pipeline must satisfy to deploy — if the BE cannot verify it, it cannot ship.

## Required fields

- **Title** — business-level, imperative and specific.
- **What** — a brief description of the business-level change. No implementation detail, no stack layers, no task-sized breakdown — that's the Task Planner's job, one step downstream.
- **Why** — justification for building it _now_.
- **KPIs** (optional) — a hypothesis with a number and a window (e.g. "decrease abandoned carts by 23% over 30 days"). Omit rather than invent one with no credible basis.
- **Verification steps** — the contract. See below.

Do not author tasks or validation criteria here. A feature is decomposed into tasks by the Task Planner, collaboratively with the BE — that decomposition is a separate step, governed by the `task-authoring` skill.

## Verification steps — the rules

Verification is **human judgment**, executed by the BE in a non-prod environment. This is the opposite proof mechanism from a task's validation criteria (machine-checked, no human judgment) — don't write a verification step that's really a validation criterion in disguise.

Each step must be:

- **BE-executable** — something a human can actually do and observe in a non-prod environment.
- **Tied to the business outcome** — proves the feature delivers what it promised, not an implementation detail.
- **A pass/fail judgment the BE renders** — not "run this test", which belongs at the task level.

Before / after:

- ✗ `POST /api/checkout returns 201.` (machine-checkable — a task validation criterion, not a business verification)
- ✓ `As a shopper, complete checkout with a valid card in the staging environment and confirm the order appears in the order history with a paid status.` (a human runs this and judges it)

If every step you can write is really machine-checkable, the "feature" may already be task-sized — flag it back to the BE rather than forcing a verification step that doesn't fit.

## Sign-off gate

A feature is **not** ready-to-work until it has What + Why + verification steps **and** explicit BE sign-off. No sign-off, no downstream decomposition — the Task Planner refuses an unsigned feature.

## Template

```
Title:
What:
Why:
KPIs (optional):
  - <hypothesis, a number, a window>
Verification steps:
  - <BE-executable, non-prod, pass/fail judgment>
  - <BE-executable, non-prod, pass/fail judgment>
Signed off by (BE):
```
