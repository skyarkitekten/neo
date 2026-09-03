# Getting started with Neo

Neo is a **concept-to-spec-to-PR multi-agent coding system** for GitHub Copilot CLI. You hand it
business intent; a crew of agents turns that intent into a machine-checkable **spec** and drives it
toward a draft pull request — with a human in the loop at every gate that matters.

New to the vocabulary? Read the [glossary](./glossary.md) first, then
[concepts/architecture.md](./concepts/architecture.md) for the one idea everything rests on
(**task = spec**). This page is the on-ramp; the two guides below are where the work happens.

> **Status key:** `[live]` — built and usable today · `[target]` — part of the end-state design,
> not yet built. Neo ships more design than code right now; these markers tell you which is which so
> nothing here overclaims.

## What's live vs. target

Neo is designed as four loops (see [architecture.md](./concepts/architecture.md)). The first two
are built:

| Loop | What it does | Status |
| --- | --- | --- |
| **Product loop** | Problem/opportunity → research → viability/desirability/feasibility → **PRD** | `[live]` |
| **Specification loop** | PRD/requirements → **Feature** (business, human-signed) → **Task** (spec, ≈ 1 PR) | `[live]` |
| **Coding loop** | Research → plan → implement → review → draft PR | `[live]` |
| **Verification / Operations** | PR review, smoke/user test, CD, telemetry | `[target]` |

So today you use Neo to **turn intent into a signed-off, machine-checkable task set** — and, if you
don't already have a PRD, to produce one first. The issue→PR pipeline is the direction of travel,
not a claim about what runs end-to-end yet. The `code-writer`, `code-reviewer`, `researcher`, and
`implementation-planner` agents ship, but the loop that orchestrates them autonomously is still
`[target]`.

## The 60-second model

- A **Feature** is the *business* unit: **What**, **Why**, optional **KPIs**, and
  **verification steps**. A human — the **Business Engineer (BE)** — signs it. This is the contract.
- A **Task** is the *spec* unit: derived from one feature, sized to ≈ one pull request, carrying
  **validation criteria** a machine can run to a deterministic pass/fail.
- **Humans verify features; machines validate tasks.** Proof is authored when the unit is defined,
  never retrofitted.

That's the whole bet. [architecture.md](./concepts/architecture.md) explains why a task-sized spec
is the thing you can actually automate.

## Pick your path

- **I want to run Neo in my repo.** → [guides/installing-neo.md](./guides/installing-neo.md) —
  install `neo-core`, write your project's `AGENTS.md`, add a loop or a stack.
- **I want to drive the crew.** → [guides/using-neo.md](./guides/using-neo.md) — produce a PRD,
  then work the Specification loop with the BE.
- **I want to hand in a piece of work.** → [guides/filing-work.md](./guides/filing-work.md) — what a
  well-formed Feature and Task look like.
- **I want to change Neo itself.** → [contributing/README.md](./contributing/README.md) — contracts,
  authoring, hooks.

## Install (quickest path)

Neo is packaged for GitHub Copilot CLI:

```
copilot plugin marketplace add skyarkitekten/neo
copilot plugin install neo-core@neo
```

`neo-core` is the baseline. If you don't have a PRD yet, add the optional Product loop:

```
copilot plugin install neo-product@neo
```

Then invoke the crew from your project. Full setup — including the `AGENTS.md` your project needs
and how stack plugins bind — is in [guides/installing-neo.md](./guides/installing-neo.md).
