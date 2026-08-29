---
name: neo-system-thinking
description:
  'Facilitate systems thinking sessions — map boundaries, stocks and flows, feedback loops, delays, leverage points,
  upstream/downstream dependencies, system archetypes, and intervention design. Use when investigating why problems
  persist, why growth stalls, why interventions backfire, or where high-leverage change points exist. Produces analysis
  artifacts in docs/design/.'
argument-hint:
  "Describe the system, behavior pattern, or problem you want to analyze (e.g. 'why does our backlog keep growing',
  'find leverage points in our intake process', 'trace ripple effects of removing the approval gate')"
---

# System Thinking

## Overview

This skill orchestrates the full systems thinking lifecycle. Each phase has a dedicated reference that contains detailed
procedures, output formats, and rules.

## Recommended Workflow

```
boundary-definition → stock-and-flow-mapping → causal-loop-mapping
    → delay-analysis → leverage-point-analysis
    → upstream-downstream-synthesis
    → archetype-recognition → intervention-design
```

## Phase Routing

| Activity                    | Reference                                                                    | Use When                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Scope the analysis          | [boundary-definition](references/boundary-definition.md)                     | Starting any systems analysis; clarifying what is inside/outside the system; mapping inputs, outputs, and neighbors |
| Map accumulations and rates | [stock-and-flow-mapping](references/stock-and-flow-mapping.md)               | Diagnosing why queues grow, resources deplete, backlogs build, or capacity fluctuates                               |
| Trace feedback loops        | [causal-loop-mapping](references/causal-loop-mapping.md)                     | Investigating why problems persist, growth stalls, interventions backfire, or systems oscillate                     |
| Surface time lags           | [delay-analysis](references/delay-analysis.md)                               | Diagnosing oscillation, over-correction, policy churn, or why interventions seem to have no effect                  |
| Find intervention points    | [leverage-point-analysis](references/leverage-point-analysis.md)             | Deciding where to act; evaluating why past interventions had limited impact; prioritizing improvements              |
| Map cross-boundary effects  | [upstream-downstream-synthesis](references/upstream-downstream-synthesis.md) | Analyzing how changes propagate across boundaries; identifying hidden coupling; tracing blast radius                |
| Match to known patterns     | [archetype-recognition](references/archetype-recognition.md)                 | Diagnosing recurring problems; explaining why standard fixes don't work; accelerating analysis                      |
| Design the intervention     | [intervention-design](references/intervention-design.md)                     | Planning changes against system structure; evaluating competing proposals; designing safeguards                     |

## How to Use This Skill

1. **Identify the phase.** Match the user's request to a row in the routing table above.
2. **Check the boundary.** If the matched phase is not boundary-definition and no prior boundary artifact exists in
   `docs/design/system-boundaries/`, run boundary-definition first before proceeding to the requested phase.
3. **Load the reference.** Read the linked reference file for the detailed procedure, output format, and rules. If the
   reference file cannot be found, notify the user with the exact missing path and halt that phase until the file is
   available. Do not attempt to infer the procedure without the reference.
4. **Follow the procedure.** Execute each step in the reference, producing the specified output artifact.
5. **Hand off.** Use the handoff guidance in each reference to feed outputs into the next phase.
6. **Handle multi-phase requests.** If the user's request maps to more than one phase, execute them in the order
   defined in the Recommended Workflow, completing each phase's artifact before starting the next.

## Output Locations

All systems analysis artifacts are written to `docs/design/`:

| Artifact Type            | Location                                               |
| ------------------------ | ------------------------------------------------------ |
| System boundaries        | `docs/design/system-boundaries/`                       |
| Stock-and-flow maps      | `docs/design/system-models/<topic>-stocks-flows.md`    |
| Causal loop diagrams     | `docs/design/system-models/<topic>-causal-loops.md`    |
| Delay analyses           | `docs/design/system-models/<topic>-delays.md`          |
| Leverage point analyses  | `docs/design/system-models/<topic>-leverage-points.md` |
| Upstream/downstream maps | `docs/design/system-models/<topic>-dependencies.md`    |
| Archetype analyses       | `docs/design/system-models/<topic>-archetypes.md`      |
| Intervention plans       | `docs/design/system-models/<topic>-intervention.md`    |

## Constraints

- Only edit files under `docs/` — do not modify source code, infrastructure, or configuration files
- Do not make source-code or infrastructure implementation decisions — this skill maps system dynamics and behavior, not code or deployment structure
- Do not evaluate business viability — delegate to the `Neo Product Coach` agent
- Present leverage points as hypotheses, not certainties — they require validation
