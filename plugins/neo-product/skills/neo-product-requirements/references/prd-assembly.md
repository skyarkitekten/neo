# PRD Assembly

The canonical PRD template for Draft mode is defined in [../assets/prd-template.md](../assets/prd-template.md). Use that
structure when writing a PRD from context gathered during questioning, or when evaluating section completeness in Review
mode.

---

## Minimum Viable PRD

A PRD must have at minimum:

1. **Problem Statement** — specific, evidence-backed, with "why now"
2. **Non-Goals** — explicit out-of-scope statements
3. **At least one measurable success metric** — with a target and timeframe
4. **User stories** — tagged P0/P1/P2 with acceptance criteria
5. **Functional Requirements** — P0 set must be minimal and defensible

Do not approve or ship a PRD missing any of these five elements.

---

## Quality Check

Run this before presenting a PRD for stakeholder review:

| Check                    | Question                                                               |
| ------------------------ | ---------------------------------------------------------------------- |
| Problem grounded         | Is the problem statement backed by evidence, not just opinion?         |
| "Why now" answered       | Does the Problem Statement explain timing urgency?                     |
| Non-goals present        | Does the document explicitly state what is out of scope?               |
| Stories prioritized      | Is every user story tagged P0/P1/P2?                                   |
| Stories complete         | Does every P0 story have acceptance criteria?                          |
| Success measurable       | Can every success metric be measured with available tools?             |
| Requirements tagged      | Are all functional requirements tagged P0/P1/P2?                       |
| Dependencies owned       | Does every dependency have an identified owner?                        |
| Critical risks mitigated | Does every high-impact risk have a mitigation plan?                    |
| Narrative compelling     | Would an executive read the narrative and feel compelled to fund this? |
| No orphaned placeholders | Are all "[TBD]" items flagged as open questions?                       |

Flag any failing checks in the Open Questions section.

---

## Save Location

Write to `docs/design/requirements/<feature>/prd.md`.
