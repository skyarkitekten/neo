---
name: neo-system-thinking
description:
  'Facilitate systems thinking sessions — map boundaries, stocks and flows, feedback loops, delays, leverage points,
  upstream/downstream dependencies, system archetypes, and intervention design. Use when investigating why problems
  persist, why growth stalls, why interventions backfire, or where high-leverage change points exist. Produces analysis
  artifacts in docs/design/.'
argument-hint:
  "Describe the system, behavior pattern, or problem you want to analyze (e.g. 'why does our backlog keep growing',
  'find leverage points in the claims intake process', 'trace ripple effects of removing the approval gate')"
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
2. **Load the reference.** Read the linked reference file for the detailed procedure, output format, and rules.
3. **Follow the procedure.** Execute each step in the reference, producing the specified output artifact.
4. **Hand off.** Use the handoff guidance in each reference to feed outputs into the next phase.

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
- Do not make architecture or implementation decisions — hand structural questions to the `architecture` agent
- Do not evaluate business viability — delegate to the `product-coach`
- Never skip boundary definition — every analysis must start by defining what is inside and outside the system
- Present leverage points as hypotheses, not certainties — they require validation
