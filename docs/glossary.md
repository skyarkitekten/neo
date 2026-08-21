# Neo Glossary

Canonical vocabulary for the Neo Agentic SDLC. Define a term once — here — and link to it from other docs, agents, and skills rather than restating it.

**Status key:** `[live]` designed and drafted this cycle · `[target]` part of the end-state design (Diagram 2), not yet specced.

## Roles

**Business Engineer (BE)** `[live]` — The single human who owns a feature from business intent through decomposition. Same seat as "the business", "business analyst", and the scrum "product owner". Explicitly **not** the hand-off BA who transcribes a PO and passes notes to engineers — Neo removes that hand-off. The BE authors and signs the feature contract _and_ co-owns Feature→Task decomposition, so intent is never laundered through a middleman.

**Product Engineer** `[live]` — The agent (`neo.product.engineer`, `neo-product`) that runs the **Product loop**: fans out **Product Researchers**, sequences the three lenses (**Product Coach**, **Design Thinking Facilitator**, **Systems Thinking Facilitator**), and drives the result to a **PRD**. It orchestrates rather than authors — the analysis belongs to the lenses, the PRD drafting to the Product Coach. Canonical `name:` is **Neo Product Engineer**.

**Product Researcher** `[live]` — Agent (`neo-product`) that answers one scoped product-discovery question — existing code and docs, prior decisions, users, market context. Fanned out in parallel, one question each. Distinct from **Researcher** below, which investigates *how the code works* for an already-specified task.

**Product Coach / Design Thinking Facilitator / Systems Thinking Facilitator** `[live]` — The Product loop's three lenses: **viability** (should we build this?), **desirability** (do people need this?), and **feasibility & dynamics** (how does this behave in the real world?). The Product Coach also drafts the PRD in Phase 5.

**Researcher** `[target]` — Agent that gathers context feeding the Specification and Coding loops.

**Implementation Planner** `[target]` — The `Research → Plan → Implement` phase in the Coding loop that breaks a **task** into **steps**. Named for what it produces, matching **Task Planner** below.

**Team Leader / Coder** `[target]` — Coding-loop agents; the Team Leader coordinates Coders, who implement using stack skills.

**SRE Agent / Platform Engineering Agent** `[target]` — Operations & Deployment agents.

## Units of work

**PRD / Requirements** `[live]` — High-level product or system requirements. Produced by the **Product loop** (`neo-product`), then segmented by the BE as the input to the Specification loop. A PRD must be **segmentable** — each segment carrying its own business justification — which is the gate at [Boundary 0](./concepts/process-flow.md#boundary-0--product--specification). Its format is owned by the `neo-product-requirements` skill.

**Feature** `[live]` — The business-level unit. Carries What, Why, optional KPIs, and verification steps; signed off by the BE. A feature is **not** the spec.

**Task** `[live]` — The spec-level unit; the spec analog. Derives from exactly one feature, sized to ≈ one pull request, and carries machine-checkable validation criteria. Shrinking the spec to task grain is Neo's central move.

**Step** `[target]` — A unit inside the Coding loop, ≈ one commit. Authored during implementation, not during decomposition.

## Proof

**Verification** `[live]` — Human judgment proving a **feature** meets its business contract, executed by the BE in a non-prod environment.

**Validation** `[live]` — Machine execution (unit tests, system tests, autonomous agents) proving a **task** meets its spec. No human judgment.

> **Verify features, validate tasks. Humans verify, machines validate.**

**The contract** `[live]` — A feature's verification steps, authored at feature-definition time. The gate the whole pipeline must satisfy to deploy: if the BE cannot verify it, it cannot ship.

## Loops & spaces (Diagram 2)

**Product loop** `[live]` — The loop *upstream* of the Specification loop, shipped by the `neo-product` plugin: research fan-out → viability/desirability/feasibility lenses → synthesis → **PRD**. It answers "what should exist, and why" and is the origin of the PRD that Neo previously assumed into being. Human-gated at two points: the decision to proceed past synthesis, and the BE's acceptance of the PRD at [Boundary 0](./concepts/process-flow.md#boundary-0--product--specification). It does **not** absorb or replace `feature-agent`/`task-planner`.

**Specification loop** `[partly live]` — PRD→Feature and Feature→Task; problem space into solution space. Human-gated: _Start Human, Finish Human; Critical Thinking required._

**Coding loop** `[target]` — `Research → Planner → Implement` across Build, Validation, and Verification spaces. Ends at Review → Code Review → PR.

**Verification loop / Operations & Deployment** `[target]` — PR Review, Smoke Test, User Test, CD, Telemetry. _Human Judgement Required._

## Artifacts

**neo-task-authoring** `[live]` — The skill defining what a clean task is: fields, validation-criteria format, one-PR sizing rule.

**Task handoff schema** `[live]` — The normative definition of the **Task** artifact that crosses Boundary 1 (Specification → Coding): its carrier (a Task *is* the GitHub Issue / Azure DevOps story it is filed as), fields, and on-harness format. See [`task-handoff-schema.md`](./contributing/reference/task-handoff-schema.md).

**Task Planner** `[live]` — The agent (`task-planner`) that runs interactive Feature→Task decomposition with the BE. Named for what it produces (tasks), matching **Implementation Planner**.

**Feature Skill / Feature Agent** `[target]` — The level above `neo-task-authoring` / `task-planner`: PRD-segment → Feature.

---

**Planner naming.** The two planners are named by output, never by level: **Task Planner** (Feature → Tasks, spec loop) and **Implementation Planner** (Task → Steps, coding loop). The PRD→Feature agent is deliberately **not** a "Feature Planner" — it is the **Feature Agent**, to avoid colliding with the two planners one level down.
