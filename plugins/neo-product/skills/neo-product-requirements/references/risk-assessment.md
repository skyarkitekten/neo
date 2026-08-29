# Risk Assessment

## When to Use

- Identifying what could prevent the feature from succeeding
- Evaluating risks before committing engineering effort
- Creating mitigation plans for high-impact risks
- Ensuring the team has eyes open about what could go wrong

## Procedure

### 1. Identify Risks

Draw risks from every prior PRD activity:

| Source             | Risk Type           | Example                                             |
| ------------------ | ------------------- | --------------------------------------------------- |
| Problem validation | Market / need risk  | The problem is not as widespread as assumed         |
| Stakeholder impact | Organizational risk | A key stakeholder blocks the feature                |
| User stories       | Usability risk      | Users cannot complete the workflow without training |
| Success criteria   | Measurement risk    | We cannot accurately measure the outcome            |
| Scope definition   | Scope risk          | Deferred items turn out to be essential             |
| Dependencies       | Delivery risk       | A critical dependency is delayed                    |

Compile the full risk inventory:

| ID    | Risk                  | Category                                                                  | Source                            |
| ----- | --------------------- | ------------------------------------------------------------------------- | --------------------------------- |
| R-001 | _what could go wrong_ | _Market / Technical / Organizational / Regulatory / Delivery / Usability_ | _which PRD section surfaced this_ |

### 2. Assess Likelihood and Impact

| ID    | Risk   | Likelihood (1–5) | Impact (1–5) | Risk Score | Priority                       |
| ----- | ------ | ---------------- | ------------ | ---------- | ------------------------------ |
| R-001 | _risk_ | _score_          | _score_      | _product_  | Critical / High / Medium / Low |

**Priority thresholds:**

- **Critical** (score 20–25): Must have mitigation plan before development starts
- **High** (score 12–19): Must have mitigation plan before the risk could materialize
- **Medium** (score 6–11): Monitor actively, have a contingency in mind
- **Low** (score 1–5): Accept and monitor

### 3. Define Mitigation Strategies

For every Critical and High risk:

| ID    | Risk   | Strategy                             | Action            | Owner                | Trigger            |
| ----- | ------ | ------------------------------------ | ----------------- | -------------------- | ------------------ |
| R-001 | _risk_ | Avoid / Mitigate / Transfer / Accept | _specific action_ | _who is responsible_ | _when to activate_ |

**Strategies:**

- **Avoid** — Change the plan so the risk cannot occur
- **Mitigate** — Reduce likelihood or impact through proactive action
- **Transfer** — Shift the risk to another party (vendor, insurance, partner team)
- **Accept** — Acknowledge the risk and monitor without active mitigation

### 4. Link to Assumptions

Cross-reference with the scope definition's assumption table:

| Risk ID | Related Assumption | Assumption Confidence | If Assumption Fails        |
| ------- | ------------------ | --------------------- | -------------------------- |
| R-001   | _assumption_       | High / Medium / Low   | _what happens to the risk_ |

Low-confidence assumptions that underpin Critical risks should be escalated to `design-thinking` for assumption testing.

### 5. Save the Assessment

Write to `docs/design/requirements/<feature>/risks.md`.

## Output Format

1. Risk inventory with categories and sources
2. Likelihood/impact matrix with priority ratings
3. Mitigation plans for Critical and High risks
4. Assumption cross-reference
5. Risk review cadence — when and how often risks are re-evaluated

## Rules

- Critical risks without mitigation plans are blockers — do not proceed to development
- Risks are not one-time artifacts — schedule periodic reviews as development progresses
- Be specific — "something could go wrong" is not a risk; "the payment API may not support batch processing" is
- Link every risk to its source — traceability prevents risks from being dismissed as hypothetical
- If the risk assessment reveals the feature is dominated by Critical risks, escalate to the Product Coach for a
  build/no-build reassessment
