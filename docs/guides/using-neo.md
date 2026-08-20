# Using Neo

For the **operator** — usually the **Business Engineer (BE)** — driving the crew through the
Specification loop. Assumes Neo is already installed (see
[installing-neo.md](./installing-neo.md)). Terms in **bold** are in the
[glossary](../glossary.md).

> **Status:** the Specification loop (PRD → Feature → Task) is `[live]` and interactive. The Coding
> loop that would then carry a Task to a draft PR autonomously is `[target]`; today the
> orchestrator and worker agents exist, but you drive the spec work hands-on with the BE at the
> gates. See [getting-started.md](../getting-started.md#whats-live-vs-target).

## The agents you'll invoke

| Agent (picker name) | Role | You invoke it? |
| --- | --- | --- |
| **Neo Feature Agent** (`feature-agent`) | Drafts a **Feature** — What/Why/KPIs/verification — from a PRD segment, with you | Yes |
| **Neo Task Planner** (`task-planner`) | Splits a signed feature into **Tasks**, with you | Yes |
| **Neo Technical Engineer** (`technical-engineer`) | Orchestrator — takes a Task (issue/story) and drives research → plan → implement → review → draft PR | Yes |
| **Neo Researcher / Implementation Planner / Code Writer / Code Reviewer** | Coding-loop workers the orchestrator delegates to | No — the orchestrator wires them |

The workers are deliberately sharp and single-purpose; they don't know each other or the whole
spec. The orchestrator (and you) wire them together.

## The Specification loop, step by step

This is the part that's `[live]`. It is **interactive and human-gated** — never autonomous — because
a bad split poisons everything downstream.

1. **PRD → Feature.** Invoke **Neo Feature Agent** with a PRD/requirements segment. It drafts
   **What**, **Why**, optional **KPIs**, and **verification steps**, working with you. It stops at a
   **BE-signed feature** — it does not decompose tasks. Entry to *ready-to-work* requires What + Why
   + verification steps **and** your sign-off. If you can't verify it, it can't ship.

2. **Feature → Tasks.** Invoke **Neo Task Planner** on the signed feature. It proposes a breakdown,
   surfaces its uncertainty, and converges with you. Default to **logical chunks (vertical slices)**,
   not stack layers. Each Task is sized to **≈ one PR** and carries **validation criteria** that are
   machine-checkable. "Done" is a **BE-approved** task set, not an agent-emitted one.

3. **Task → draft PR** `[target for full autonomy]`. Invoke **Neo Technical Engineer** with a Task
   (filed as a GitHub Issue or Azure DevOps story). It branches from the spec (`feat/<issue-id>-<short-name>`),
   then runs research → plan → implement → review and opens a **draft** PR linked to the spec. It
   pauses twice for you: **`/fleet`** before research and planning, and **`/rubber-duck`** on the plan
   before implementation. Findings loop back to the writer until the reviewer approves. All work stays
   on that feature branch; it never commits to `main` and never merges.

## Your job at the gates

Neo puts the human where judgment is irreplaceable and lets machines handle the rest:

- **Author proof when you define the unit.** Verification steps at feature time; validation criteria
  at task time. Don't retrofit them.
- **Own the decomposition.** The task split is a conversation, not a hand-off. Push back when the
  planner is unsure.
- **Verify features yourself.** Verification is human judgment against the business contract;
  validation (tests + agents) is the machine's job against the spec. See
  [architecture.md § The core rule](../concepts/architecture.md#the-core-rule).

## What "well-formed work" looks like

Before you file a Task for the orchestrator, make sure it meets the handoff bar — one feature of
origin, one-PR sizing, machine-checkable validation criteria. That's its own page:
[filing-work.md](./filing-work.md).

## Tuning the crew

If runs feel off, log them and read the per-agent stats to fix the weakest prompt — see
[../contributing/guides/observability.md](../contributing/guides/observability.md). That's a
contributor-flavored task, but operators running many features find it worth it.
