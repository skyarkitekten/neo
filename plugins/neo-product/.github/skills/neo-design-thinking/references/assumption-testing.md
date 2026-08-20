# Assumption Testing

## When to Use

- A design, journey map, or prototype rests on beliefs that haven't been validated
- Stakeholders disagree about what users want or how they'll behave
- Before investing significant effort in building something — test the riskiest bet first
- After ideation, to determine which concepts deserve prototyping
- When a previous assumption proved wrong and the team needs to re-validate

## Procedure

### 1. Surface Assumptions

Examine the design artifacts (journey maps, service blueprints, personas, problem frames) and list every assumption they
depend on:

| #   | Assumption                   | Source                         | Type                                   |
| --- | ---------------------------- | ------------------------------ | -------------------------------------- |
| 1   | _what we believe to be true_ | _which artifact or discussion_ | Desirability / Feasibility / Viability |

**Types:**

- **Desirability** — Do users actually want this?
- **Feasibility** — Can we build and operate this?
- **Viability** — Does this make business sense?

### 2. Assess Risk

For each assumption, evaluate:

| #   | Assumption   | Confidence (1–5)  | Impact if Wrong (1–5)    | Risk Score            |
| --- | ------------ | ----------------- | ------------------------ | --------------------- |
| 1   | _assumption_ | _how sure are we_ | _how bad if we're wrong_ | _confidence × impact_ |

Sort by risk score descending. The top 3–5 are the ones to test.

### 3. Design Experiments

For each high-risk assumption, define a lightweight test:

| Assumption        | Experiment          | Method                                                           | Duration       | Success Signal          | Failure Signal           |
| ----------------- | ------------------- | ---------------------------------------------------------------- | -------------- | ----------------------- | ------------------------ |
| _what we believe_ | _how we'll test it_ | _interview / prototype test / A-B test / data analysis / survey_ | _hours / days_ | _what we'd see if true_ | _what we'd see if false_ |

**Experiment methods** (prefer cheapest first):

1. **Desk research** — does existing data already answer this?
2. **Stakeholder interviews** — 3–5 conversations
3. **Prototype test** — show a low-fidelity mock and observe reactions
4. **Concierge test** — manually deliver the experience to a small group
5. **A/B test** — compare two approaches with real usage data

### 4. Define Decision Criteria

For each experiment, specify what happens with the result:

| Result                             | Action                                                            |
| ---------------------------------- | ----------------------------------------------------------------- |
| Assumption **validated**           | Proceed with design as planned                                    |
| Assumption **partially validated** | Adjust design to address gaps, re-test if needed                  |
| Assumption **invalidated**         | Pivot — revisit the problem frame or explore alternative concepts |

### 5. Save the Test Plan

Write to `docs/design/assumption-tests/<topic>.md`.

## Output Format

Each assumption test document should contain:

1. Design reference — which artifacts the assumptions come from
2. Full assumption inventory table
3. Risk assessment with prioritization
4. Experiment designs for top-risk assumptions
5. Decision criteria per experiment
6. Status tracker (planned / in-progress / validated / invalidated)

## Rules

- Test the RISKIEST assumption first, not the easiest
- Prefer the cheapest experiment that produces a clear signal
- Define success and failure signals BEFORE running the experiment — no moving goalposts
- Update the test plan with results as experiments complete
- If a core assumption is invalidated, escalate to the `product-coach` for pivot/persevere decision
