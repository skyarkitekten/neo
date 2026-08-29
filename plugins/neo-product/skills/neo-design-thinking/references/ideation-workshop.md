# Ideation Workshop

## When to Use

- A problem frame (POV + HMW questions) is defined and the team is ready to explore solutions
- The team is stuck on a single solution and needs to expand the option space
- Evaluating multiple competing ideas and need a structured way to converge
- Generating concepts before prototyping or journey mapping a future state

## Procedure

### 1. Set Up the Session

Confirm prerequisites:

- A problem frame exists in `docs/design/problem-frames/` — if not, run Problem Framing first
- Select 1–3 HMW questions as ideation prompts
- List any constraints (technical, regulatory, time, budget) that bound the solution space

### 2. Diverge — Generate Ideas

Apply structured ideation techniques. Choose one or more:

**Crazy 8s:** Generate 8 distinct ideas in rapid succession. Quantity over quality. No filtering.

**SCAMPER:** Apply each lens to the existing process or a baseline idea:

| Lens                 | Question                                          |
| -------------------- | ------------------------------------------------- |
| **Substitute**       | What can be replaced with something else?         |
| **Combine**          | What can be merged or bundled?                    |
| **Adapt**            | What can be borrowed from another domain?         |
| **Modify**           | What can be made larger, smaller, faster, slower? |
| **Put to other use** | Can this serve a different purpose?               |
| **Eliminate**        | What can be removed entirely?                     |
| **Reverse**          | What if we did the opposite?                      |

**"Yes, And...":** Build on each idea iteratively — no idea is rejected, only extended.

Record all ideas without judgment:

| #   | Idea                | HMW Question Addressed | Technique Used                 |
| --- | ------------------- | ---------------------- | ------------------------------ |
| 1   | _brief description_ | _which HMW_            | _Crazy 8s / SCAMPER / Yes-And_ |

### 3. Converge — Evaluate and Prioritize

Score each idea against three criteria:

| #   | Idea   | User Impact (1–5) | Feasibility (1–5) | Novelty (1–5) | Total | Rank   |
| --- | ------ | ----------------- | ----------------- | ------------- | ----- | ------ |
| 1   | _idea_ | _score_           | _score_           | _score_       | _sum_ | _rank_ |

Apply dot-voting or weighted scoring to narrow down to the top 3–5 concepts.

### 4. Develop Top Concepts

For each top-ranked concept, expand into a concept card:

| Field                   | Content                                   |
| ----------------------- | ----------------------------------------- |
| **Concept Name**        | Short, memorable label                    |
| **Description**         | 2–3 sentence explanation                  |
| **User Need Addressed** | Which POV/HMW this solves                 |
| **How It Works**        | Brief walkthrough of the experience       |
| **Key Assumptions**     | What must be true for this to succeed     |
| **Risks**               | What could go wrong                       |
| **Next Step**           | Prototype / journey map / assumption test |

### 5. Save the Ideation Summary

Write to `docs/design/ideation/<topic>.md`.

## Output Format

Each ideation document should contain:

1. Session setup — HMW questions, constraints, techniques used
2. Full idea inventory table
3. Scoring and prioritization table
4. Concept cards for top 3–5 ideas
5. Recommended next steps per concept

## Rules

- NEVER ideate without a defined problem — run Problem Framing first
- Diverge before converging — no filtering during idea generation
- Volume matters — aim for 15+ ideas before evaluating
- All ideas are recorded, even ones that are not selected — they may become relevant later
- Flag key assumptions per concept for handoff to Assumption Testing
