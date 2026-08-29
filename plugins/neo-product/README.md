# neo-product

**Status: live.** The Product loop's agents and skills are authored and invokable. Installable
as a working crew.

## What this plugin is

`neo-product` ships the **Product loop** — a loop upstream of the existing Specification
loop. Neo's `PRD → Specification` boundary
([`process-flow.md`](https://github.com/skyarkitekten/neo/blob/main/docs/concepts/process-flow.md)) used to assume a PRD/requirements
document simply exists; this loop is what produces it. It is **upstream of**, not a
replacement for, `neo-core`'s specification crew (`feature-agent`, `task-planner`, the BE) —
the PRD this loop emits is what the BE then segments into features.

## Shape

- **Orchestrator:** `neo.product.engineer.agent.md` — **Neo Product Engineer**.
- **Phases** — a default sequence, not a rigid pipeline; research runs in parallel and on
  demand throughout:
  - **Phase 0 — Fan out research** (Intake / Ingest Code & Docs)
  - **Phase 1–3 — The three lenses**: viability, desirability, feasibility
  - **Phase 4 — Synthesize**, human gate
  - **Phase 5 — Produce the PRD** — the artifact that leaves this loop
- **Sub-capabilities** — separate invokable agents the orchestrator delegates to, not prompt
  sections of one agent.
- **Output:** a **PRD**, written to `docs/design/requirements/`, crossing the existing
  `PRD → Specification` boundary. The PRD must be *segmentable* — that is the handoff
  contract. The orchestrator does not invoke the Specification loop itself.

## What's inside

**Agents** (`agents/`, `neo.<domain>.<role>.agent.md`):

| File | Agent `name:` | Role |
| --- | --- | --- |
| `neo.product.engineer.agent.md` | `Neo Product Engineer` | Orchestrates the loop; the entry point. `user-invocable` |
| `neo.product.researcher.agent.md` | `Neo Product Researcher` | One scoped discovery question per invocation; fanned out in parallel |
| `neo.product.coach.agent.md` | `Neo Product Coach` | Viability — *should we build this?* Drafts the PRD |
| `neo.design.thinking.agent.md` | `Neo Design Thinking Facilitator` | Desirability — *do people need this?* |
| `neo.systems.thinking.agent.md` | `Neo Systems Thinking Facilitator` | Feasibility & dynamics — *how does this behave?* |

The agents are **domain-neutral**. Product, industry, and regulatory context come from the
consuming repo's `AGENTS.md`, PRDs, ADRs, and design docs — never baked into a prompt.

**Skills** (`skills/`):

| Skill | Owns |
| --- | --- |
| `neo-product-requirements` | PRD structure, the drafting procedure, and `assets/prd-template.md`. **Normative** — Phase 5 does not improvise a format |
| `neo-design-thinking` | Stakeholder/empathy mapping, personas, problem framing, journey mapping, ideation, assumption testing, service blueprinting |
| `neo-system-thinking` | Boundaries, stocks and flows, causal loops, delays, leverage points, archetypes, intervention design |

**Hooks** (`hooks/hooks.json`, v1 schema, `${PLUGIN_ROOT}`): the same fail-open
observability logging and fail-closed guardrail enforcement as `neo-core`, via this plugin's
own `hooks/scripts/log-event.{sh,ps1}` and `hooks/scripts/enforce-guardrails.{sh,ps1}`
(duplicated, not shared — plugins cannot reference files outside their own directory; see
[`plugin-contract.md`](https://github.com/skyarkitekten/neo/blob/main/docs/contributing/reference/plugin-contract.md#1-plugin-folder-shape)).

## Why a new plugin and not a `neo-core` addition

`docs/contributing/reference/stack-plugin-contract.md` treats a domain wanting its own agent
as a signal to check first, not a routine extension. Answer recorded here: the Product loop
is a distinct phase that runs *before* the Specification loop begins — it does not fit the
process/technology/project tiers `neo-core` already owns, and it does not replace or absorb
`feature-agent`/`task-planner`. It therefore ships as its own plugin rather than as an
addition to `neo-core`'s specification crew.

## Install

```
copilot plugin marketplace add skyarkitekten/neo
copilot plugin install neo-product@neo
```

Pairs with `neo-core`, which consumes the PRD this loop produces.

## License

MIT
