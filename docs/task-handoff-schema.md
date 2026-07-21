# Task Handoff Schema

Terms in **bold** are defined in the [glossary](./glossary.md).

This is the **normative** definition of the single artifact that crosses **Boundary 1
(Specification → Coding)** in [`process-flow.md`](./process-flow.md): the **Task** the
**Task Planner** emits and the **Team Leader / orchestrator** consumes. It fixes the artifact's
identity, fields, and on-harness format so the emitter and consumer agree on one object.

It does **not** restate the logical rules for a clean task — those live in the
[`task-authoring`](../.github/skills/task-authoring/SKILL.md) skill and are referenced, not
duplicated. This doc adds the **carrier** (what the task *is*) and the **serialization** (where
each field lives on a GitHub Issue and an Azure DevOps story).

> **Provisional.** This schema is the item most likely to churn once the E2E dry run (#23)
> exercises it end to end. Treat it as provisional until the dry run confirms the emitter and
> consumer actually agree on it in practice.

---

## 1. The carrier rule

**One Task = one GitHub Issue = one Azure DevOps story.** A neo **Task** has no existence
separate from the issue/story it is filed as. The issue/story *is* the task; there is no second
document.

This resolves the drift recorded in [`process-flow.md`](./process-flow.md) § Boundary 1 and
[`todo.md`](../todo.md) §11: `neo-technical-engineer` declares its input as "a GitHub Issue or
Azure DevOps story," while the Specification loop emits a **Task**. Those are the same object,
stated here once so both sides bind to it.

Consequences:

- The **Task id** is the issue number / work-item id (and its URL). Nothing else identifies a
  task.
- The draft **PR** that closes the task links back to it by that id (`Closes #<n>` on GitHub, a
  work-item link on Azure DevOps).
- A task that is not filed as an issue/story does not exist and cannot cross Boundary 1.

### Naming caution (Azure DevOps)

A neo **Task** maps to the project's chosen **story-grade** work item — typically a *User Story*
or *Product Backlog Item*. It does **not** map to the Azure DevOps work-item type literally
named *Task* (which is a sub-story checklist item, closer to a neo **Step**). Pick the
story-grade type at project setup and use it consistently.

---

## 2. Fields

Every task carries the fields below. "Source" names where the field's rules are defined: the
`task-authoring` skill owns the logical fields; this doc owns the carrier/handoff fields.

| Field | Required | Meaning | Source |
| --- | --- | --- | --- |
| **Task id** | ✅ | The issue number / work-item id + URL. The task's only identity (§1). | this doc |
| **Title** | ✅ | Imperative and specific (`Add checkout POST endpoint`). | `task-authoring` |
| **Parent feature** | ✅ | Link to the **one** BE-signed feature this task derives from. No orphans. | `task-authoring` |
| **What** | ✅ | The technical change, detailed enough that a Coder needs no further business input. | `task-authoring` |
| **Validation criteria** | ✅ | The machine-checkable proof the task is complete. These *are* the "acceptance criteria" the consumer reads (§5). | `task-authoring` |
| **Depends on** | optional | Declared ordering against sibling tasks under the same feature. Absent = independent. | this doc |
| **BE-approved** | ✅ to cross | Marker that the task belongs to a **BE-approved task set**. Boundary 1 is a human gate; an unapproved task does not cross. | this doc |

Notes:

- **Validation criteria** must be machine-checkable per `task-authoring` — no human-judgment
  criteria. Human judgment is **verification**, and it lives at the **feature**, not here.
- **Depends on** expresses *only* declared ordering. A task must still be independently
  validatable (`task-authoring` § Sizing); dependency is about sequence, not about a criterion
  that can't pass until a sibling ships.
- **Integration mode is not a field.** Whether the task PRs into a feature branch or to the
  default branch behind a flag is a project-level choice ([`process-flow.md`](./process-flow.md)
  § Integration modes), not per-task data. The schema is identical under either mode.

---

## 3. Format — GitHub Issue

| Field | Location on the issue |
| --- | --- |
| Task id | The issue number and URL (assigned by GitHub on creation). |
| Title | Issue title. |
| Parent feature | `## Parent feature` section — a link to the feature's issue/URL. |
| What | `## What` section. |
| Validation criteria | `## Validation criteria` section — a bullet list, one criterion per line. |
| Depends on | `## Depends on` section — a list of task ids (`#<n>`), or `None`. |
| BE-approved | The `be-approved` label. Absent label = not yet cleared to cross. |

### Canonical issue body

The emitter writes exactly this shape; the consumer parses exactly this shape.

```markdown
## Parent feature
#<feature-issue-number>   <!-- the one BE-signed feature this task derives from -->

## What
<the technical change, in enough detail that a Coder needs no further business input>

## Validation criteria
- <machine-checkable statement>
- <machine-checkable statement>

## Depends on
- #<sibling-task>   <!-- or: None -->
```

---

## 4. Format — Azure DevOps story

| Field | Location on the work item |
| --- | --- |
| Task id | Work-item id + URL. |
| Title | `Title` field. |
| Parent feature | **Parent** link to the feature's work item. |
| What | `Description` field. |
| Validation criteria | `Acceptance Criteria` field — one criterion per line. |
| Depends on | **Predecessor** link(s) to sibling task work items. |
| BE-approved | State transition to the project's approved state (e.g. *Approved*), or a `be-approved` tag. |

The story-grade work-item type is fixed at project setup (§1, Naming caution).

---

## 5. Contracts

### Emitter — Task Planner (#15)

- Produces **one** issue/story per task, in the format of §3 / §4, with every required field
  present.
- Files a task **only** as part of a **BE-approved task set** and marks it `be-approved`. It
  never emits an agent-invented task ([`neo.task-planner.agent.md`](../.github/agents/neo.task-planner.agent.md)).
- Conforms to `task-authoring` for the logical fields. If it cannot express a machine-checkable
  validation criterion, the task is under-specified — sharpen or split, don't file it.

### Consumer — Team Leader / orchestrator (#11)

- Treats the issue/story it is handed **as** the task (§1). The
  [`neo-technical-engineer`](../.github/agents/neo.technical-engineer.agent.md) "GitHub Issue or
  Azure DevOps story" input and the spec loop's "Task" are one object.
- May assume all required fields (§2) are present and the task is `be-approved`. If a required
  field is missing or the approval marker is absent, it stops and routes back — it does **not**
  invent scope to fill the gap ([`neo-code-writer`](../.github/agents/neo.code-writer.agent.md)).
- Reads the **Validation criteria** as the spec's **acceptance criteria** it plans and
  validates against (§ naming reconciliation).

### Naming reconciliation — validation criteria = acceptance criteria

`task-authoring` calls the machine-checkable proof **validation criteria**; the consumer agents
([orchestrator](../.github/agents/neo.technical-engineer.agent.md),
[implementation-planner](../.github/agents/neo.implementation-planner.agent.md)) call the spec's
pass/fail statements **acceptance criteria**. In this schema they are the **same field**: the
task's validation criteria are exactly the acceptance criteria the consumer maps units to.
The two names refer to one list; do not treat them as separate inputs.

---

## 6. Out of scope

This schema defines the crossing artifact and nothing else. It deliberately does not cover:

- **Logical task rules** — field semantics, machine-checkability, one-PR sizing:
  [`task-authoring`](../.github/skills/task-authoring/SKILL.md).
- **Feature fields** (What/Why/KPIs/verification steps) and BE sign-off:
  [`feature-authoring`](../.github/skills/feature-authoring/SKILL.md).
- **Integration mode** and traceability-under-squash:
  [`process-flow.md`](./process-flow.md) § Integration modes.
- **Step decomposition** inside the Coding loop — a task becomes steps during implementation,
  not here ([`neo.implementation-planner.agent.md`](../.github/agents/neo.implementation-planner.agent.md)).
