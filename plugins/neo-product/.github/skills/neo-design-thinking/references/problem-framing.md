# Problem Framing

## When to Use

- Transitioning from empathy/research into ideation — the Define phase
- The team is jumping to solutions without agreeing on the problem
- A request arrives framed as a solution ("build X") and needs reframing as a need ("users need Y")
- Multiple empathy maps or personas exist and the team needs to converge on priorities
- Preparing inputs for an ideation workshop

## Procedure

### 1. Gather Empathy Evidence

Before framing the problem, ensure sufficient empathy data exists:

- Check `docs/design/empathy-maps/` for empathy research
- Check `docs/design/personas/` for user profiles
- If evidence is thin, recommend running Empathy Mapping first

Summarize the key findings that will inform the problem statement.

### 2. Craft the Point-of-View Statement

Use the format:

> **[User]** needs a way to **[need]** because **[insight]**.

Guidelines:

- **User** — a specific persona or stakeholder, not "the user"
- **Need** — a verb-based need, not a feature or solution
- **Insight** — grounded in observed behavior or empathy data, not assumptions

Create 2–3 candidate POV statements, then evaluate:

| POV Statement | Specificity  | Need-Based? | Insight Quality | Selected? |
| ------------- | ------------ | ----------- | --------------- | --------- |
| _statement 1_ | High/Med/Low | Yes/No      | Strong/Weak     | ✓/✗       |

### 3. Generate How Might We Questions

Decompose the selected POV into "How Might We" (HMW) questions — each one opening a different angle for ideation:

- **HMW [verb] [aspect]?** — one question per facet of the problem

Aim for 5–8 HMW questions. Good HMW questions are:

- Narrow enough to be actionable
- Broad enough to allow multiple solutions
- Positive in framing (opportunity, not complaint)

### 4. Prioritize

Rank HMW questions by:

| HMW Question | User Impact (1–5) | Feasibility (1–5) | Evidence Strength (1–5) | Priority       |
| ------------ | ----------------- | ----------------- | ----------------------- | -------------- |
| _question_   | _score_           | _score_           | _score_                 | _High/Med/Low_ |

The highest-priority HMW questions become the starting points for ideation.

### 5. Save the Problem Frame

Write to `docs/design/problem-frames/<topic>.md`.

## Output Format

Each problem frame document should contain:

1. Evidence summary — which empathy maps and personas informed this
2. Candidate POV statements with evaluation
3. Selected POV statement
4. HMW question set with prioritization
5. Recommended next step (typically Ideation Workshop)

## Rules

- A problem frame MUST be backed by empathy evidence — no evidence, no frame
- POV statements describe needs, NEVER solutions
- HMW questions open possibilities — they should not imply a specific answer
- Revisit the problem frame if ideation reveals the problem was misframed
- One problem frame per POV statement
