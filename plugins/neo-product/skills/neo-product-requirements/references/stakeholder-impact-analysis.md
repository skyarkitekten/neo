# Stakeholder Impact Analysis

## When to Use

- Assessing who benefits from and who bears cost of a proposed feature
- Identifying stakeholders who can block delivery (compliance, legal, security)
- Resolving conflicting priorities between user groups before writing stories
- Ensuring the PRD accounts for all affected parties

## Procedure

### 1. Import Stakeholder Data

Check `docs/design/stakeholder-maps/` for existing stakeholder research. If a stakeholder map exists, use it as the
starting point. If not, run a lightweight identification:

List every group that:

- **Uses** the feature directly
- **Is affected by** the feature's outputs or side effects
- **Operates or supports** the feature post-launch
- **Approves or governs** the feature (compliance, legal, security)
- **Funds** the feature (sponsors, budget owners)

### 2. Assess Impact per Stakeholder

For each stakeholder group, evaluate:

| Stakeholder | Benefits         | Costs / Burdens                             | Can Block? | Current Involvement         |
| ----------- | ---------------- | ------------------------------------------- | ---------- | --------------------------- |
| _group_     | _what they gain_ | _new work, risk, or complexity they absorb_ | Yes/No     | Active / Informed / Unaware |

### 3. Surface Conflicts

Identify where stakeholder interests collide:

| Tension            | Stakeholder A Wants | Stakeholder B Wants | Resolution Needed                |
| ------------------ | ------------------- | ------------------- | -------------------------------- |
| _name the tension_ | _goal_              | _competing goal_    | _how must the PRD address this?_ |

Unresolved conflicts become risks. Resolved conflicts become design constraints captured in the scope definition.

### 4. Define RACI

For each major PRD activity, assign responsibility:

| Activity              | Responsible | Accountable | Consulted | Informed |
| --------------------- | ----------- | ----------- | --------- | -------- |
| Requirements sign-off | _who_       | _who_       | _who_     | _who_    |
| Design review         | _who_       | _who_       | _who_     | _who_    |
| Development           | _who_       | _who_       | _who_     | _who_    |
| Acceptance testing    | _who_       | _who_       | _who_     | _who_    |
| Go-live decision      | _who_       | _who_       | _who_     | _who_    |

### 5. Save the Analysis

Write to `docs/design/requirements/<feature>/stakeholder-impact.md`.

## Output Format

1. Stakeholder inventory with impact assessment
2. Conflict/tension table with resolution guidance
3. RACI matrix for key activities
4. Recommendations for stakeholder engagement during development

## Rules

- Every stakeholder who can block delivery MUST be identified — surprises at sign-off are preventable
- Costs/burdens are as important as benefits — features that help one group while burdening another need explicit
  trade-off decisions
- If a critical stakeholder is "Unaware," flag it — they need to be engaged before requirements are finalized
- Import from `docs/design/stakeholder-maps/` whenever stakeholder maps already exist — do not duplicate research
