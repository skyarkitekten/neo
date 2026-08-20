---
name: neo-design-thinking
description:
  'Facilitate human-centered design thinking activities: stakeholder mapping, empathy mapping, persona definitions,
  problem framing, journey mapping, ideation workshops, assumption testing, and service blueprinting. Use when: running
  design workshops, defining users, mapping experiences, framing problems, brainstorming solutions, validating
  assumptions, or blueprinting services. Produces design artifacts in docs/design/.'
argument-hint: 'Describe the design activity you need or the problem space to explore'
---

# Design Thinking

## When to Use

- Starting a new project or entering an unfamiliar domain
- Defining who the users are and what they need
- Mapping user experiences or service operations
- Framing problems before jumping to solutions
- Generating and evaluating solution concepts
- Validating assumptions before building

## Recommended Workflow

Design thinking activities build on each other. Follow this sequence when starting from scratch, or jump to the relevant
activity if prior work exists:

```
1. Stakeholder Mapping  →  Who is involved?
2. Empathy Mapping      →  What do they think, feel, and need?
3. Persona Definitions  →  Who are the key user archetypes?
4. Problem Framing      →  What problem are we solving?
5. Journey Mapping      →  What is the current/future experience?
6. Ideation Workshop    →  What solutions could work?
7. Assumption Testing   →  Which beliefs need validation?
8. Service Blueprinting →  How does the service operate end-to-end?
```

Not every project needs all eight. Use the routing table below to pick the right activity.

## Activity Routing

| Trigger                                                        | Activity             | Reference                                                       |
| -------------------------------------------------------------- | -------------------- | --------------------------------------------------------------- |
| New project, unknown stakeholders, competing priorities        | Stakeholder Mapping  | [stakeholder-mapping.md](./references/stakeholder-mapping.md)   |
| Need to understand what users think, feel, and experience      | Empathy Mapping      | [empathy-mapping.md](./references/empathy-mapping.md)           |
| Need shared user archetypes to ground design decisions         | Persona Definitions  | [persona-definitions.md](./references/persona-definitions.md)   |
| Transitioning from research to ideation, reframing requests    | Problem Framing      | [problem-framing.md](./references/problem-framing.md)           |
| Visualizing step-by-step user experiences, finding pain points | Journey Mapping      | [journey-mapping.md](./references/journey-mapping.md)           |
| Brainstorming solutions, expanding the option space            | Ideation Workshop    | [ideation-workshop.md](./references/ideation-workshop.md)       |
| Unvalidated beliefs, risky assumptions before building         | Assumption Testing   | [assumption-testing.md](./references/assumption-testing.md)     |
| Mapping frontstage/backstage operations, handoff gaps          | Service Blueprinting | [service-blueprinting.md](./references/service-blueprinting.md) |

## Procedure

### 1. Identify the Right Activity

Use the routing table above. If unsure, start with **Stakeholder Mapping**.

### 2. Check for Existing Artifacts

Search `docs/design/` for prior work:

- `docs/design/stakeholder-maps/`
- `docs/design/empathy-maps/`
- `docs/design/personas/`
- `docs/design/problem-frames/`
- `docs/design/journey-maps/`
- `docs/design/ideation/`
- `docs/design/assumption-tests/`
- `docs/design/service-blueprints/`

Build on existing artifacts rather than starting over.

### 3. Read the Activity Reference

Load the appropriate reference file from the routing table and follow its procedure. If the reference file cannot be
found, notify the user that the reference is missing and proceed using general design thinking best practices for
that activity, clearly labeling the output as based on defaults rather than the project reference.

### 4. Save the Output

Each activity produces a markdown document in its designated `docs/design/` subfolder. Follow the output format
specified in the reference file.

### 5. Determine the Next Step

After completing an activity, recommend the logical next step from the workflow sequence. Cross-reference the routing
table to guide the user forward.

### Handling Multiple Activities

If the user requests multiple activities at once, execute them in the recommended workflow sequence, completing and
saving each artifact before starting the next. Reference the prior artifact as input to the subsequent activity.

## Shared Rules

- Ground all findings in evidence — label assumptions explicitly
- Produce one artifact per distinct subject — one file per persona, one file per journey (per user type and
  scenario), one file per service
- All artifacts are living documents — update them as new evidence emerges
- Approach every activity with empathy for the people affected — it is the foundation of design thinking, even when
  the routing table sends you directly to an activity other than Empathy Mapping
- Hand system structure questions to the `system-designer`
- Escalate pivot/persevere decisions to the `product-coach`
