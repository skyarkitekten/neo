# Delay Analysis

**Phase:** Dynamics — Step 2 **Requires:** [causal-loop-mapping](causal-loop-mapping.md) **Feeds into:**
[leverage-point-analysis](leverage-point-analysis.md), [intervention-design](intervention-design.md)

## When to Use

- System oscillates — things improve then degrade in cycles
- An intervention was made but "nothing happened" — the effect may be delayed
- Teams keep over-correcting because they can't see the effect of prior actions
- Policy churn — rules keep changing because results aren't visible fast enough
- After causal loop mapping, to understand why loops produce surprising behavior

## Key Concepts

- **Material delay** — physical time for things to move (shipping, hiring, building)
- **Information delay** — time for data to become visible to decision-makers (reporting lag, feedback lag)
- **Decision delay** — time for people to recognize a situation and choose action
- **Implementation delay** — time between deciding and executing (approvals, procurement, deployment)

Delays are the primary reason systems surprise us. A balancing loop with a long delay produces oscillation. A
reinforcing loop with a hidden delay produces overshoot and collapse.

## Procedure

### 1. Identify the Surprising Behavior

What is the team observing that doesn't match their expectations?

| Expected Behavior                | Observed Behavior        | Gap            |
| -------------------------------- | ------------------------ | -------------- |
| _what they thought would happen_ | _what actually happened_ | _the surprise_ |

### 2. Map the Action-to-Effect Chain

For the relevant intervention or process, trace the full chain from action to observable effect:

| Step | Action/Event     | Next Step           | Delay Type                                         | Estimated Duration | Visibility         |
| ---- | ---------------- | ------------------- | -------------------------------------------------- | ------------------ | ------------------ |
| 1    | _initial action_ | _what happens next_ | Material / Information / Decision / Implementation | _time estimate_    | _who can see this_ |
| 2    | _next event_     | _what follows_      | _type_                                             | _duration_         | _visibility_       |

Sum the delays to find the total lag between action and observable result.

### 3. Identify Delay-Induced Behaviors

Match the delay structure to known behavior patterns:

| Delay Pattern                         | Resulting Behavior     | Example                                                                    |
| ------------------------------------- | ---------------------- | -------------------------------------------------------------------------- |
| Balancing loop + long delay           | Oscillation            | Hiring surge → training lag → overstaffed → layoffs → understaffed         |
| Reinforcing loop + hidden delay       | Overshoot and collapse | Growth investment → delayed market feedback → over-investment → correction |
| Information delay                     | Over-correction        | Late metrics → panic response → over-steering → new problem                |
| Decision delay + implementation delay | Stale interventions    | Slow approval → environment changed → fix no longer relevant               |

### 4. Assess Delay Impact

For each significant delay:

| Delay   | Location in System   | Duration | Impact on Behavior        | Can It Be Shortened? | Cost of Shortening |
| ------- | -------------------- | -------- | ------------------------- | -------------------- | ------------------ |
| _delay_ | _where in the chain_ | _time_   | _what behavior it drives_ | Yes / No / Partially | _effort required_  |

### 5. Identify Delay-Related Risks

| Risk                  | Trigger                                        | Consequence                           | Mitigation                                             |
| --------------------- | ---------------------------------------------- | ------------------------------------- | ------------------------------------------------------ |
| Over-correction       | Long information delay leads to late awareness | Oscillation, wasted resources         | Shorten feedback loop, add leading indicators          |
| Premature abandonment | Implementation delay exceeds patience          | Good intervention cancelled too early | Set expectations for delay duration upfront            |
| Compounding delays    | Serial delays in a chain multiply total lag    | System appears unresponsive           | Parallelize where possible, track intermediate signals |

### 6. Design Leading Indicators

For each significant delay, propose intermediate signals that provide earlier visibility:

| Delayed Outcome                   | Leading Indicator | How to Measure       | How Far Ahead    |
| --------------------------------- | ----------------- | -------------------- | ---------------- |
| _the thing you're waiting to see_ | _earlier signal_  | _measurement method_ | _time advantage_ |

### 7. Save the Analysis

Write to `docs/design/system-models/<topic>-delays.md`.

## Output Format

Each delay analysis document should contain:

1. Surprising behavior being investigated
2. Action-to-effect chain with delay types and durations
3. Delay-induced behavior pattern identification
4. Delay impact assessment
5. Delay-related risks
6. Leading indicators to shorten effective feedback time
7. Recommendations — which delays to shorten and how

## Rules

- Delays are measured in real time, not ideal time — use actual observed durations, not planned ones
- Distinguish delay types — material, information, decision, and implementation delays have different remedies
- The most dangerous delays are invisible ones — probe for "what don't we see and when?"
- Shortening a delay is often more effective than adding a new intervention
- Leading indicators are hypotheses — validate them before relying on them
