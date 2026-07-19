# neo Glossary

Canonical vocabulary for the Neo Agentic SDLC. Define a term once — here — and link to it from other docs, agents, and skills rather than restating it.

**Status key:** `[live]` designed and drafted this cycle · `[target]` part of the end-state design (Diagram 2), not yet specced.

## Roles

**Business Engineer (BE)** `[live]` — The single human who owns a feature from business intent through decomposition. Same seat as "the business", "business analyst", and the scrum "product owner". Explicitly **not** the hand-off BA who transcribes a PO and passes notes to engineers — neo removes that hand-off. The BE authors and signs the feature contract *and* co-owns Feature→Task decomposition, so intent is never laundered through a middleman.

**Researcher** `[target]` — Agent that gathers context feeding the Specification and Coding loops.

**Implementation Planner** `[target]` — The `Research → Plan → Implement` phase in the Coding loop that breaks a **task** into **steps**. Named for what it produces, matching **Task Planner** below.

**Team Leader / Coder** `[target]` — Coding-loop agents; the Team Leader coordinates Coders, who implement using stack skills.

**SRE Agent / Platform Engineering Agent** `[target]` — Operations & Deployment agents.

## Units of work

**PRD / Requirements** — High-level product or system requirements, segmented as the input to the Specification loop.

**Feature** `[live]` — The business-level unit. Carries What, Why, optional KPIs, and verification steps; signed off by the BE. A feature is **not** the spec.

**Task** `[live]` — The spec-level unit; the spec analog. Derives from exactly one feature, sized to ≈ one pull request, and carries machine-checkable validation criteria. Shrinking the spec to task grain is neo's central move.

**Step** `[target]` — A unit inside the Coding loop, ≈ one commit. Authored during implementation, not during decomposition.

## Proof

**Verification** `[live]` — Human judgment proving a **feature** meets its business contract, executed by the BE in a non-prod environment.

**Validation** `[live]` — Machine execution (unit tests, system tests, autonomous agents) proving a **task** meets its spec. No human judgment.

> **Verify features, validate tasks. Humans verify, machines validate.**

**The contract** `[live]` — A feature's verification steps, authored at feature-definition time. The gate the whole pipeline must satisfy to deploy: if the BE cannot verify it, it cannot ship.

## Loops & spaces (Diagram 2)

**Specification loop** `[partly live]` — PRD→Feature and Feature→Task; problem space into solution space. Human-gated: *Start Human, Finish Human; Critical Thinking required.*

**Coding loop** `[target]` — `Research → Planner → Implement` across Build, Validation, and Verification spaces. Ends at Review → Code Review → PR.

**Verification loop / Operations & Deployment** `[target]` — PR Review, Smoke Test, User Test, CD, Telemetry. *Human Judgement Required.*

## Artifacts

**task-authoring** `[live]` — The skill defining what a clean task is: fields, validation-criteria format, one-PR sizing rule.

**Task Planner** `[live]` — The agent (`task-planner`) that runs interactive Feature→Task decomposition with the BE. Named for what it produces (tasks), matching **Implementation Planner**.

**Feature Skill / Feature Agent** `[target]` — The level above `task-authoring` / `task-planner`: PRD-segment → Feature.

---

**Planner naming.** The two planners are named by output, never by level: **Task Planner** (Feature → Tasks, spec loop) and **Implementation Planner** (Task → Steps, coding loop). Do not reintroduce a "Feature Planner" — it collides with the Feature Agent one level up.
