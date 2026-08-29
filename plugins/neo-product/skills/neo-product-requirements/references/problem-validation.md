# Problem Validation

## When to Use

- Starting a new PRD and need to confirm the problem is real and worth solving
- A feature request arrived framed as a solution ("build X") and needs reframing
- Stakeholders disagree about what problem is being solved
- No prior problem-framing or Product Coach assessment exists

## Procedure

### 1. Check for Upstream Evidence

Search for existing validation work:

| Source                   | Location                        | What It Provides                                  |
| ------------------------ | ------------------------------- | ------------------------------------------------- |
| Problem frames           | `docs/design/problem-frames/`   | POV statements, HMW questions                     |
| Product Coach assessment | Product Coach output            | Business Model Canvas, value proposition analysis |
| Assumption tests         | `docs/design/assumption-tests/` | Validated/invalidated beliefs                     |
| Empathy maps             | `docs/design/empathy-maps/`     | User pain points and needs                        |

If a validated problem statement already exists, summarize it and proceed to Stakeholder Impact Analysis.

### 2. State the Problem

Write a clear problem statement:

> **[Who]** currently experiences **[problem]** when **[context]**, which results in **[consequence]**.

Evaluate the statement against these criteria:

| Criterion       | Question                                                               | Pass?  |
| --------------- | ---------------------------------------------------------------------- | ------ |
| Specific        | Does it name a real user group, not "users" or "the business"?         | Yes/No |
| Evidence-backed | Is there data, research, or observation supporting this?               | Yes/No |
| Need-based      | Does it describe a need or pain, not a feature?                        | Yes/No |
| Consequential   | Does it explain why this matters (cost, risk, harm, lost opportunity)? | Yes/No |
| Scoped          | Is the problem narrow enough to act on in one initiative?              | Yes/No |

If any criterion fails, refine the statement or gather more evidence.

### 3. Quantify the Impact

Where possible, attach numbers to the problem:

| Metric                | Current State                             | Source                             |
| --------------------- | ----------------------------------------- | ---------------------------------- |
| _e.g., time per task_ | _e.g., 45 minutes average_                | _observation / report / interview_ |
| _e.g., error rate_    | _e.g., 12% of submissions require rework_ | _system data_                      |
| _e.g., cost_          | _e.g., $X per incident_                   | _finance / operations data_        |

If no quantitative data exists, note the gap and recommend it as a prerequisite or assumption to test.

### 4. Confirm Strategic Alignment

Validate that solving this problem aligns with broader goals:

| Question                                           | Answer                                           |
| -------------------------------------------------- | ------------------------------------------------ |
| Which strategic objective does this support?       | _objective_                                      |
| What happens if we do NOT solve this?              | _consequence_                                    |
| Is this the highest-priority problem in this area? | _yes / no — if no, why are we doing this first?_ |

### 5. Save the Validation

Write to `docs/design/requirements/<feature>/problem-validation.md`.

## Output Format

1. Upstream evidence summary (what prior work exists)
2. Problem statement with criteria evaluation
3. Impact quantification table (or gap acknowledgment)
4. Strategic alignment assessment
5. Go/no-go recommendation for proceeding to requirements

## Rules

- If the problem cannot pass the criteria check, STOP — do not write requirements for an unvalidated problem
- "The customer wants it" is not a valid problem statement — probe for the underlying need
- If evidence is thin, recommend using the `design-thinking` skill (Empathy Mapping or Assumption Testing activities) before continuing
- Quantitative impact is preferred but not required — qualitative evidence from empathy research is acceptable
