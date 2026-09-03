# Neo Glossary

Canonical vocabulary for the Neo Agentic SDLC. Define a term once here and link to it from other docs, agents, and skills rather than restating it.

**Status key:** `[live]` designed and drafted this cycle · `[target]` part of the end-state design (Diagram 2), not yet specced.

## Roles

**Agents work for humans.** Every seat below comes in a pair: an unprefixed name is a real
human being, and its **Neo**-prefixed counterpart is the agent that supports that human in the
role. The human owns the judgment calls and the sign-offs; the agent does the legwork and holds
the gates open. Never the reverse, and never conflate the two — "Business Engineer" is always a
person, "Neo Business Engineer" is always software.

### Human roles

**Product Engineer** `[live]` — The human who stares down an open problem and finds the shape of something worth building. Same seat as "product manager" or "product lead" — the one who turns a hunch, a complaint, or a raw opportunity into a product other people can build a future on.

**Business Engineer** `[live]` — The human who turns intent into action. You take what the business actually needs and shape it into something an engineer can build — without losing the *why* in the handoff. Same seat as "the business," "business analyst," and the scrum "product owner" — but never the transcription-and-toss-it-over-the-wall BA. You author the feature contract, you sign it, and you stay in the room through Feature→Task decomposition, because the person who understands the intent is the person who should decide what "done" means.

**Technical Engineer** `[live]` — The human who turns a plan into working software and stands behind it. Same seat as "the developer" or "the engineer" — the craftsperson who carries a task from spec to draft PR, making the calls no spec can fully anticipate.

### Agent roles

**Neo Business Engineer** `[live]` — The *agent* (`neo.business-engineer`, `neo-core`) that supports the human Business Engineer in this task. It may be handed a PRD, a subset of a PRD, or a raw feature to elaborate, and runs the **Specification loop** on the Business Engineer's behalf: segments the PRD, sequences the **Feature Agent** and **Task Planner** for each segment, files the approved tasks as their carrier issues, and spawns one session per task running the **Neo Technical Engineer**. It is **not** the Business Engineer — it holds the gates open, it does not pass through them. Feature sign-off and task-set approval remain the human's, always. Canonical `name:` is **Neo Business Engineer**.

**Neo Product Engineer** `[live]` — The agent (`neo.product.engineer`, `neo-product`) that supports the human Product Engineer by running the **Product loop**: fans out **Product Researchers**, sequences the three lenses (**Product Coach**, **Design Thinking Facilitator**, **Systems Thinking Facilitator**), and drives the result to a **PRD**. It orchestrates rather than authors — the analysis belongs to the lenses, the PRD drafting to the Product Coach. Canonical `name:` is **Neo Product Engineer**.

**Neo Technical Engineer** `[live]` — The agent (`neo.technical-engineer`, `neo-core`) that supports the human Technical Engineer by taking a **Task** (filed as a GitHub Issue or Azure DevOps story) and driving it through research → plan → implement → review to a draft PR, delegating implementation to **Code Writer** and review to **Code Reviewer**. Canonical `name:` is **Neo Technical Engineer**.

**Product Researcher** `[live]` — Agent (`neo-product`) that answers one scoped product-discovery question — existing code and docs, prior decisions, users, market context. Fanned out in parallel, one question each. Distinct from **Researcher** below, which investigates *how the code works* for an already-specified task.

**Product Coach** `[live]` — Agent (`neo-product`) for the **viability** lens: should we build this? Also drafts the PRD in Phase 5.

**Design Thinking Facilitator** `[live]` — Agent (`neo-product`) for the **desirability** lens: do people need this?

**Systems Thinking Facilitator** `[live]` — Agent (`neo-product`) for the **feasibility & dynamics** lens: how does this behave in the real world?

**Researcher** `[target]` — Agent that gathers context feeding the Specification and Coding loops.

**Implementation Planner** `[target]` — The `Research → Plan → Implement` phase in the Coding loop that breaks a **task** into **steps**. Named for what it produces, matching **Task Planner** below.

**Team Leader / Coder** `[target]` — Coding-loop agents; the Team Leader coordinates Coders, who implement using stack skills.

**SRE Agent / Platform Engineering Agent** `[target]` — Operations & Deployment agents.

## Units of work

**PRD / Requirements** `[live]` — High-level product or system requirements. Produced by the **Product loop** (`neo-product`), then segmented by the Business Engineer as the input to the Specification loop. A PRD must be **segmentable** — each segment carrying its own business justification — which is the gate at [Boundary 0](./concepts/process-flow.md#boundary-0--product--specification). Its format is owned by the `neo-product-requirements` skill.

**Feature** `[live]` — The business-level unit. Carries What, Why, optional KPIs, and verification steps; signed off by the Business Engineer. A feature is **not** the spec.

**Task** `[live]` — The spec-level unit; the spec analog. Derives from exactly one feature, sized to ≈ one pull request, and carries machine-checkable validation criteria. Shrinking the spec to task grain is Neo's central move.

**Step** `[target]` — A unit inside the Coding loop, ≈ one commit. Authored during implementation, not during decomposition.

## Proof

**Verification** `[live]` — Human judgment proving a **feature** meets its business contract, executed by the Business Engineer in a non-prod environment.

**Validation** `[live]` — Machine execution (unit tests, system tests, autonomous agents) proving a **task** meets its spec. No human judgment.

> **Verify features, validate tasks. Humans verify, machines validate.**

**The contract** `[live]` — A feature's verification steps, authored at feature-definition time. The gate the whole pipeline must satisfy to deploy: if the Business Engineer cannot verify it, it cannot ship.

## Loops & spaces (Diagram 2)

**Product loop** `[live]` — The loop *upstream* of the Specification loop, shipped by the `neo-product` plugin: research fan-out → viability/desirability/feasibility lenses → synthesis → **PRD**. It answers "what should exist, and why" and is the origin of the PRD that Neo previously assumed into being. Human-gated at two points: the decision to proceed past synthesis, and the Business Engineer's acceptance of the PRD at [Boundary 0](./concepts/process-flow.md#boundary-0--product--specification). It does **not** absorb or replace `feature-agent`/`task-planner`.

**Specification loop** `[live]` — PRD→Feature and Feature→Task; problem space into solution space. Human-gated: *Start Human, Finish Human; Critical Thinking required.*

**Coding loop** `[target]` — `Research → Planner → Implement` across Build, Validation, and Verification spaces. Ends at Review → Code Review → PR.

**Verification loop / Operations & Deployment** `[target]` — PR Review, Smoke Test, User Test, CD, Telemetry. *Human Judgement Required.*

## Artifacts

**neo-task-authoring** `[live]` — The skill defining what a clean task is: fields, validation-criteria format, one-PR sizing rule.

**Task handoff schema** `[live]` — The normative definition of the **Task** artifact that crosses Boundary 1 (Specification → Coding): its carrier (a Task *is* the GitHub Issue / Azure DevOps story it is filed as), fields, and on-harness format. See [`task-handoff-schema.md`](./contributing/reference/task-handoff-schema.md).

**Task Planner** `[live]` — The agent (`task-planner`) that runs interactive Feature→Task decomposition with the Business Engineer. Named for what it produces (tasks), matching **Implementation Planner**.

**Feature Skill / Feature Agent** `[live]` — The level above `neo-task-authoring` / `task-planner`: PRD-segment → Feature. The `neo-feature-authoring` skill defines what a clean feature is; the `feature-agent` runs the interactive drafting with the Business Engineer.

---

**Neo, stylized.** The system is always written **Neo** in prose — never "neo", never "NEO".
Lowercase `neo` appears only as a literal identifier: plugin names (`neo-core`, `neo-product`),
the marketplace (`neo`) and install targets (`neo-core@neo`), agent filenames
(`neo.<role>.agent.md`), skill directories (`neo-feature-authoring`), and repository paths. Inside
code fences and inline code, reproduce the identifier exactly — do not "correct" it.

**Planner naming.** The two planners are named by output, never by level: **Task Planner** (Feature → Tasks, spec loop) and **Implementation Planner** (Task → Steps, coding loop). The PRD→Feature agent is deliberately **not** a "Feature Planner" — it is the **Feature Agent**, to avoid colliding with the two planners one level down.
