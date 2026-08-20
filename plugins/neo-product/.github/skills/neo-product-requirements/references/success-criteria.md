# Success Criteria

## When to Use

- Defining how the team will know the feature worked
- Setting measurable targets before development begins
- Aligning stakeholders on what "done" and "successful" mean
- Creating a basis for post-launch evaluation

## Procedure

### 1. Distinguish Completion from Success

Two separate questions:

| Question         | What It Measures                                | Example                                   |
| ---------------- | ----------------------------------------------- | ----------------------------------------- |
| **Is it done?**  | Delivery — all stories implemented and accepted | All Must stories pass acceptance criteria |
| **Did it work?** | Outcome — the problem is actually reduced       | Error rate dropped from 12% to under 5%   |

Define both. Completion criteria come from user stories. Success criteria come from the problem statement.

### 2. Define Outcome Metrics

Link each metric back to the problem statement:

| Metric             | Baseline        | Target       | Measurement Method      | Timeframe          |
| ------------------ | --------------- | ------------ | ----------------------- | ------------------ |
| _what you measure_ | _current value_ | _goal value_ | _how you'll measure it_ | _when to evaluate_ |

**Good metrics are:**

- **Specific** — "reduce average claim processing time" not "improve efficiency"
- **Measurable** — has a number attached
- **Time-bound** — measured at a defined point after launch
- **Attributable** — the feature can plausibly influence this metric

### 3. Define Leading Indicators

Outcome metrics often lag. Identify early signals that indicate whether the feature is on track:

| Leading Indicator               | What It Signals                           | Measurement Method | Check Point           |
| ------------------------------- | ----------------------------------------- | ------------------ | --------------------- |
| _e.g., adoption rate in week 1_ | _users are finding and using the feature_ | _analytics_        | _1 week post-launch_  |
| _e.g., support ticket volume_   | _users are not confused by the feature_   | _support system_   | _2 weeks post-launch_ |

### 4. Define Guardrail Metrics

Guardrails ensure the feature does not cause harm elsewhere:

| Guardrail Metric                    | Acceptable Range             | Action if Breached                 |
| ----------------------------------- | ---------------------------- | ---------------------------------- |
| _e.g., system response time_        | _< 2 seconds p95_            | _investigate, roll back if needed_ |
| _e.g., error rate in adjacent flow_ | _no increase above baseline_ | _halt rollout, diagnose_           |

### 5. Save the Criteria

Write to `docs/design/requirements/<feature>/success-criteria.md`.

## Output Format

1. Completion criteria (linked to user stories)
2. Outcome metrics table with baselines and targets
3. Leading indicators table
4. Guardrail metrics table
5. Evaluation plan — who reviews, when, and what decisions follow

## Rules

- "Improve the experience" is not a success criterion — attach a number or don't claim it
- Baselines must be real — if you don't know the current state, measuring improvement is impossible
- If no baseline exists, the first action item is to establish one before or during launch
- Guardrails are non-negotiable for features that touch critical paths
- Success criteria are set BEFORE development, not rationalized after launch
