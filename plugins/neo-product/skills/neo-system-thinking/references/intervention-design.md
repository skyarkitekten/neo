# Intervention Design

**Phase:** Action — Final Step **Requires:** [leverage-point-analysis](leverage-point-analysis.md) **Bridges:** Analysis
→ Implementation

## When to Use

- A systems analysis has identified leverage points and the team is ready to act
- Evaluating a proposed change before committing resources
- Comparing competing intervention approaches
- After a previous intervention had unintended consequences and the team wants to avoid repeating the mistake
- Bridging from analysis (what we know about the system) to action (what we will change)

## Key Concepts

- **Intervention** — a deliberate change to a system's structure, rules, information flows, or goals
- **First-order effect** — the direct, intended consequence of the intervention
- **Second-order effect** — indirect consequences that emerge as the system adjusts
- **Side effect** — unintended consequences, often in distant parts of the system or after delays
- **Resilience** — the system's ability to absorb the intervention and return to its prior behavior

An effective intervention produces the desired first-order effect, has manageable second-order effects, and doesn't
trigger the system's resilience mechanisms in ways that cancel out the change.

## Procedure

### 1. Define the Intervention

Clearly state what is being proposed:

| Dimension         | Detail                                                                  |
| ----------------- | ----------------------------------------------------------------------- |
| **What**          | Precise description of what will change                                 |
| **Where**         | Which part of the system (stock, flow, loop, rule, information channel) |
| **Meadows Level** | Which level of leverage (1–12) does this operate at?                    |
| **Goal**          | What first-order effect is intended?                                    |
| **Scope**         | How much of the system is directly affected?                            |

### 2. Trace Effects Through System Structure

Using the feedback loops, stocks, and flows identified in prior analysis, trace how the intervention propagates:

| Order | Effect                   | Mechanism                         | Delay                 | Confidence |
| ----- | ------------------------ | --------------------------------- | --------------------- | ---------- |
| 1st   | _direct intended effect_ | _which flow or stock changes_     | _immediate / delayed_ | High       |
| 2nd   | _indirect effect_        | _which feedback loop activates_   | _estimated lag_       | Medium     |
| 3rd   | _further ripple_         | _which connected system responds_ | _estimated lag_       | Low        |

### 3. Check for System Resistance

Systems resist change through balancing feedback loops. For the proposed intervention, identify resistance mechanisms:

| Resistance Mechanism | How It Works                     | Likely Strength          | Timeframe                 |
| -------------------- | -------------------------------- | ------------------------ | ------------------------- |
| _what pushes back_   | _which balancing loop activates_ | Strong / Moderate / Weak | _when resistance appears_ |

Common resistance patterns:

- **Compensating feedback** — another part of the system adjusts to cancel the intervention
- **Goal displacement** — people change what they optimize for to game the new rules
- **Workarounds** — actors find paths around the intervention
- **Delayed backlash** — short-term improvement followed by long-term degradation

### 4. Identify Unintended Consequences

Systematically check for side effects using the archetype lens:

| Archetype Risk            | Applicable?                                        | How It Could Manifest |
| ------------------------- | -------------------------------------------------- | --------------------- |
| Fixes that fail           | _could the fix create new problems?_               | _description_         |
| Shifting the burden       | _does this treat a symptom instead of root cause?_ | _description_         |
| Tragedy of the commons    | _does this affect a shared resource?_              | _description_         |
| Eroding goals             | _could this lead to lowered standards?_            | _description_         |
| Success to the successful | _does this create winner-take-all dynamics?_       | _description_         |

### 5. Design Safeguards

For each identified risk, propose a safeguard:

| Risk                  | Safeguard                       | Trigger            | Action       |
| --------------------- | ------------------------------- | ------------------ | ------------ |
| _what could go wrong_ | _monitoring or circuit breaker_ | _when to activate_ | _what to do_ |

### 6. Compare Alternatives

If multiple interventions are being considered:

| Criterion           | Intervention A | Intervention B | Intervention C |
| ------------------- | -------------- | -------------- | -------------- |
| Meadows level       | _level_        | _level_        | _level_        |
| First-order effect  | _description_  | _description_  | _description_  |
| Resistance expected | Low/Med/High   | Low/Med/High   | Low/Med/High   |
| Side effect risk    | Low/Med/High   | Low/Med/High   | Low/Med/High   |
| Reversibility       | Easy/Hard      | Easy/Hard      | Easy/Hard      |
| Time to effect      | _duration_     | _duration_     | _duration_     |
| Resource cost       | Low/Med/High   | Low/Med/High   | Low/Med/High   |

### 7. Define Success Criteria and Monitoring

| Metric            | Baseline        | Target          | Measurement Method | Review Cadence       |
| ----------------- | --------------- | --------------- | ------------------ | -------------------- |
| _what to measure_ | _current value_ | _desired value_ | _how to measure_   | _how often to check_ |

Include leading indicators (early signals) and lagging indicators (outcome confirmation).

### 8. Plan for Adaptation

No intervention plan survives contact with reality perfectly. Define:

- **Checkpoint** — when will we evaluate whether the intervention is working?
- **Pivot criteria** — what would cause us to change approach?
- **Rollback plan** — if the intervention causes harm, how do we reverse it?
- **Escalation threshold** — what level of unintended consequences triggers a full stop?

### 9. Save the Plan

Write to `docs/design/system-models/<topic>-intervention.md`.

## Output Format

Each intervention design should contain:

1. Intervention definition (what, where, level, goal, scope)
2. Effect trace through system structure (1st, 2nd, 3rd order)
3. Resistance analysis
4. Unintended consequence check (archetype lens)
5. Safeguard design
6. Alternative comparison (if applicable)
7. Success criteria and monitoring plan
8. Adaptation plan (checkpoints, pivots, rollback)

## Rules

- Every intervention is a hypothesis — define what would prove it wrong
- Trace at least to second-order effects — first-order-only analysis misses most failures
- Check for system resistance — if you can't find any, you haven't looked hard enough
- Reversibility matters — prefer interventions that can be rolled back if they don't work
- The intervention should match the leverage level of the problem — parameter-level fixes for structural problems will
  fail
