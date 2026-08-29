# Scope Definition

## When to Use

- Drawing explicit boundaries around what will and will not be built
- Preventing scope creep by documenting exclusions and their rationale
- Aligning stakeholders on what the first release includes
- Separating Must-have scope from future considerations

## Procedure

### 1. Define What Is In Scope

Organize in-scope items by category:

| Category             | In Scope                                             | Source                       |
| -------------------- | ---------------------------------------------------- | ---------------------------- |
| User capabilities    | _what users will be able to do_                      | User stories (Must priority) |
| Data                 | _what data the feature reads, writes, or transforms_ | Story acceptance criteria    |
| Integrations         | _which systems this feature connects to_             | Dependency mapping           |
| Platforms / channels | _where the feature is available (web, mobile, API)_  | Product decision             |
| User roles           | _who can access the feature_                         | Stakeholder impact analysis  |

### 2. Define What Is Explicitly Out of Scope

This is the more important section. For every exclusion, state **why** it is excluded:

| Out of Scope                  | Rationale                                                                     | Revisit When                                 |
| ----------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------- |
| _capability or area excluded_ | _why: not validated, too complex for v1, blocked by dependency, low priority_ | _condition or timeframe for reconsideration_ |

Common exclusion reasons:

- **Not validated** — insufficient evidence that users need this
- **Deferred to v2** — valuable but not necessary for initial value delivery
- **Blocked** — a dependency must be resolved first
- **Out of mandate** — belongs to a different team or system

### 3. Define Constraints

Constraints are non-negotiable boundaries that shape the solution:

| Constraint                                      | Type       | Source                |
| ----------------------------------------------- | ---------- | --------------------- |
| _e.g., must use existing authentication system_ | Technical  | Architecture decision |
| _e.g., must comply with regulation X_           | Regulatory | Compliance team       |
| _e.g., must launch by Q3_                       | Timeline   | Business commitment   |
| _e.g., no additional infrastructure budget_     | Budget     | Finance               |

### 4. Define Assumptions

List what the PRD assumes to be true about the environment:

| Assumption                          | Impact if Wrong           | Confidence          |
| ----------------------------------- | ------------------------- | ------------------- |
| _e.g., API X will remain available_ | _feature cannot function_ | High / Medium / Low |

Low-confidence, high-impact assumptions should be escalated to `design-thinking` for assumption testing.

### 5. Save the Scope

Write to `docs/design/requirements/<feature>/scope.md`.

## Output Format

1. In-scope inventory table by category
2. Out-of-scope table with rationale and revisit conditions
3. Constraints table
4. Assumptions table with confidence ratings
5. Scope change process — how changes to scope are proposed and approved

## Rules

- The out-of-scope section must exist and have entries — a PRD with no exclusions has no boundaries
- Every exclusion needs a reason — "not in scope" without rationale invites re-litigation
- Constraints are discovered, not invented — cite their source (regulation, architecture decision, budget)
- If a Should-priority user story is cut from scope, move it to out-of-scope with a revisit condition
- Scope documents are living — update them when scope changes are approved, never silently
