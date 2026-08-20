# Empathy Mapping

## When to Use

- Beginning any design thinking exercise — empathy comes first
- Building shared understanding of a stakeholder group across the team
- Surfacing hidden needs, fears, and motivations that surveys miss
- Providing input for persona creation or journey mapping
- Challenging assumptions about what users want vs. what they need

## Procedure

### 1. Identify the Stakeholder

Determine who is being studied:

- What is their role relative to the system?
- What context or situation are they in when interacting with the system?
- Check `docs/design/personas/` — if a persona exists, use it as a starting point

### 2. Build the Empathy Map

For the identified stakeholder, explore six dimensions:

| Dimension        | Guiding Questions                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Think & Feel** | What are their worries, hopes, and preoccupations? What matters most to them? What keeps them up at night?                   |
| **See**          | What does their environment look like? What tools, dashboards, or information surround them? What are they exposed to daily? |
| **Say & Do**     | What do they tell others? How do they actually behave in practice (vs. what they report)? What actions do they take?         |
| **Hear**         | What are colleagues, managers, customers, or regulators telling them? What influences their decisions?                       |
| **Pains**        | What obstacles, fears, or friction points block them? What risks do they face? What frustrates them most?                    |
| **Gains**        | What does success look like from their perspective? What would make their life easier? What are they hoping for?             |

### 3. Distinguish Says vs. Needs

Explicitly call out gaps between stated preferences and observed behavior:

| What They Say       | What They Actually Do | Implied Need      |
| ------------------- | --------------------- | ----------------- |
| _stated preference_ | _observed behavior_   | _underlying need_ |

This is the most valuable part of empathy mapping — it reveals design opportunities that direct questioning misses.

### 4. Synthesize Key Insights

Distill the empathy map into 3–5 key insights:

- What is the most surprising finding?
- Where is the biggest gap between perception and reality?
- What emotional drivers are shaping behavior?
- What needs are currently unmet?

### 5. Save the Empathy Map

Write the empathy map to `docs/design/empathy-maps/<stakeholder>.md`.

## Output Format

Each empathy map document should contain:

1. Stakeholder identification (role, context, situation)
2. Six-dimension empathy map table
3. Says-vs-needs gap analysis table
4. Key insights (3–5 bullet points)
5. Recommended next steps (e.g., create persona, build journey map, investigate further)

## Rules

- NEVER skip empathy — it is the foundation of every design thinking exercise
- Ground findings in evidence (interviews, observations, data) — label assumptions explicitly
- Distinguish between what users say they want and what they actually need
- One empathy map per stakeholder group per context
- Update empathy maps as new evidence emerges — they are living documents
