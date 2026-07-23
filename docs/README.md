# neo docs

The design record for the **Neo Agentic SDLC**. Docs are grouped by *genre* — concept, reference,
guide, archive — so you can tell at a glance whether a file explains a design (**why**), fixes a
contract (**must**), or walks you through a task (**how**).

One rule holds across all of them: **define a thing once, in its owning doc, and link to it.**
Don't restate. The owner table below says who owns what.

## Start here

New to neo? Read in this order:

1. [`glossary.md`](./glossary.md) — the vocabulary. Everything else assumes these terms.
2. [`concepts/architecture.md`](./concepts/architecture.md) — what neo is: spec-at-task-grain,
   the verify/validate rule, the three loops.
3. [`concepts/process-flow.md`](./concepts/process-flow.md) — how work crosses the loop
   boundaries, plus integration modes and KPI settlement.

Then dip into `reference/` and `guides/` as the task demands.

## Map

### Vocabulary
- [`glossary.md`](./glossary.md) — canonical terms. Shared by every doc, agent, and skill.

### `concepts/` — the *why* (design & rationale)
- [`architecture.md`](./concepts/architecture.md) — the core bet (task = spec), the loops, the
  hierarchy of work.
- [`process-flow.md`](./concepts/process-flow.md) — the loop boundaries: what artifact crosses,
  what gate it clears, who owns it, where it goes on failure. Integration modes A/B; the two fits.
- [`framework-gap-analysis.md`](./concepts/framework-gap-analysis.md) — neo measured against the
  OODA / PDCA / Double-Diamond framework: where it holds, where it's ahead, and the G1–G5 gaps
  reconciled against the live backlog.

### `reference/` — the *must* (normative contracts)
- [`plugin-contract.md`](./reference/plugin-contract.md) — the mechanical contract: monorepo
  layout, per-plugin folder shape, manifest fields, `neo-` naming.
- [`stack-plugin-contract.md`](./reference/stack-plugin-contract.md) — the core/stack split: the
  three tiers, the late-binding rule, and the stack-skill discovery format.
- [`task-handoff-schema.md`](./reference/task-handoff-schema.md) — the **Task** artifact that
  crosses Boundary 1: its carrier (a Task *is* the issue/story), fields, and serialization.

### `guides/` — the *how* (operational)
- [`observability.md`](./guides/observability.md) — install the logging hooks and read the
  per-agent / per-run stats to tune prompts.
- [`enforcement.md`](./guides/enforcement.md) — the `preToolUse` enforcement hooks that block
  commit/push to `main` and non-draft PRs; their fail-closed contract and how to relax them.
- [`agent-authoring-reference.md`](./guides/agent-authoring-reference.md) — the dev-time reference
  for the `master-control` forge: frontmatter fields, agent vs skill vs instruction vs hook.
- [`neo-user-manual-outline.md`](./guides/neo-user-manual-outline.md) — skeleton for the future
  end-user manual (stub, not yet fleshed out).

### `archive/` — superseded, kept for history
- [`packaging.md`](./archive/packaging.md) — the pre-#34 dual-harness packaging design. Its live
  content moved to [`stack-plugin-contract.md`](./reference/stack-plugin-contract.md); read it only
  for historical context.

## Who owns what

| Topic | Owner |
| --- | --- |
| Vocabulary / term definitions | [`glossary.md`](./glossary.md) |
| What neo is, the loops, the core rule | [`concepts/architecture.md`](./concepts/architecture.md) |
| Loop boundaries, integration modes, KPI settlement | [`concepts/process-flow.md`](./concepts/process-flow.md) |
| Framework gap analysis (OODA–PDCA baseline, G1–G5) | [`concepts/framework-gap-analysis.md`](./concepts/framework-gap-analysis.md) |
| Plugin folder shape, manifest fields, `neo-` naming | [`reference/plugin-contract.md`](./reference/plugin-contract.md) |
| Core/stack split, tiers, stack-skill discovery | [`reference/stack-plugin-contract.md`](./reference/stack-plugin-contract.md) |
| The Task handoff artifact | [`reference/task-handoff-schema.md`](./reference/task-handoff-schema.md) |
| Logging & prompt tuning | [`guides/observability.md`](./guides/observability.md) |
| `preToolUse` enforcement (block-on-main, draft-PR-only) | [`guides/enforcement.md`](./guides/enforcement.md) |
| Authoring agents / skills / hooks | [`guides/agent-authoring-reference.md`](./guides/agent-authoring-reference.md) |

Repo-level layout, checks, and guardrails for working on neo itself live in the root
[`AGENTS.md`](../AGENTS.md), not here. None of `docs/` ships in a plugin.
