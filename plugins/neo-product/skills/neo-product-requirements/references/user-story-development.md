# User Story Development

## When to Use

- Translating validated needs into concrete, implementable stories
- Defining what users can do with the feature, in their language
- Creating acceptance criteria that developers and testers can verify
- Breaking down a large feature into deliverable increments

## Procedure

### 1. Gather Inputs

Collect the evidence that informs stories:

| Input              | Source                                                   | Status      |
| ------------------ | -------------------------------------------------------- | ----------- |
| Problem statement  | `problem-validation.md` or `docs/design/problem-frames/` | ✓ / Missing |
| Personas           | `docs/design/personas/`                                  | ✓ / Missing |
| Journey maps       | `docs/design/journey-maps/`                              | ✓ / Missing |
| Stakeholder impact | `stakeholder-impact.md`                                  | ✓ / Missing |

Stories without user evidence are guesses. If inputs are missing, note the gap and flag which stories rest on
assumptions.

### 2. Identify User Roles

List every distinct role that interacts with the feature. Use persona names when available:

| Role        | Persona Reference       | Primary Goal                         |
| ----------- | ----------------------- | ------------------------------------ |
| _role name_ | _persona doc or "none"_ | _what they are trying to accomplish_ |

### 3. Write Requirements

Choose the format that best fits the team's practice. All three are valid; pick one per PRD for consistency.

#### Format A: User Stories (default)

> **As a** [role], **I want to** [action] **so that** [outcome].

Best for: feature work where distinct user roles interact with the system.

#### Format B: Job Stories

> **When** [situation], **I want to** [motivation], **so I can** [expected outcome].

Best for: context-driven requirements where the trigger matters more than the role (e.g., notifications, automations,
background processes).

#### Format C: Requirements Table

| ID      | Requirement                     | Rationale            | Priority              |
| ------- | ------------------------------- | -------------------- | --------------------- |
| REQ-001 | The system shall _[capability]_ | _why this is needed_ | Must / Should / Could |

Best for: compliance-driven or contract-driven work where traceability to regulations or SLAs is required.

---

For each requirement (regardless of format), provide:

| ID     | Requirement                                  | Priority              | Persona / Context                   | Evidence                                             |
| ------ | -------------------------------------------- | --------------------- | ----------------------------------- | ---------------------------------------------------- |
| US-001 | _story, job story, or requirement statement_ | Must / Should / Could | _persona ref or triggering context_ | _empathy map, interview, journey map, or assumption_ |

**Priority definitions:**

- **Must** — The feature is incomplete without this. Non-negotiable.
- **Should** — Important for a good experience but can ship without in the first release.
- **Could** — Nice to have. Build only if time permits.

### 4. Write Acceptance Criteria

Every story needs acceptance criteria. Use the Given/When/Then format:

```
Story: US-001
Given [precondition]
When [action]
Then [expected result]
```

Each story should have 2–5 acceptance criteria covering:

- The happy path (normal usage)
- At least one edge case or error condition
- Any business rules or validation constraints

| Story ID | Criterion                                   | Type       |
| -------- | ------------------------------------------- | ---------- |
| US-001   | Given X, When Y, Then Z                     | Happy path |
| US-001   | Given X, When invalid Y, Then error message | Error case |

### 5. Identify Story Dependencies

Map which stories depend on others:

```
US-001 → US-003 (US-003 requires US-001 to be complete)
US-002 → (independent)
US-004 → US-001, US-002 (requires both)
```

This informs implementation sequencing.

### 6. Save the Stories

Write to `docs/design/requirements/<feature>/user-stories.md`.

## Output Format

1. Inputs summary with evidence status
2. User role inventory
3. Story table with priorities and evidence references
4. Acceptance criteria for each story (Given/When/Then)
5. Story dependency map
6. Assumptions list — which stories lack direct evidence

## Rules

- Every requirement MUST have acceptance criteria — a requirement without criteria cannot be verified
- Pick ONE format per PRD — mixing formats in a single document creates confusion
- Requirements describe USER-facing behavior or system capabilities, not internal implementation details
- Priority must be justified — why is this a Must vs. a Should?
- Requirements backed by assumptions must be labeled — they should be tested via the assumption-testing activity in `design-thinking`
- Prefer small, independently deliverable items — if a requirement takes more than a few days to build, break it down
- Do not duplicate persona work — reference existing personas by name
