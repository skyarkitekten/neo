# Contributing to Neo

You're here to **change Neo itself** — author or edit agents, skills, hooks, or the plugin
contracts. If you instead want to *use* Neo in your own repo, go back up to
[getting-started.md](../getting-started.md).

Before anything else, read the **shared core** (same for users and contributors):

- [../glossary.md](../glossary.md) — the vocabulary. Everything assumes these terms.
- [../concepts/architecture.md](../concepts/architecture.md) — task = spec, the loops, the
  verify/validate rule.
- [../concepts/process-flow.md](../concepts/process-flow.md) — loop boundaries, integration modes,
  KPI settlement.

Repo-level layout, checks, and guardrails for working on Neo live in the root
[`AGENTS.md`](../../AGENTS.md), not here. Nothing under `docs/` ships in a plugin.

## The one rule

**Define a thing once, in its owning doc, and link to it.** Don't restate. The owner table below
says who owns what.

## reference/ — the *must* (normative contracts)

- [reference/plugin-contract.md](./reference/plugin-contract.md) — the mechanical contract: monorepo
  layout, per-plugin folder shape, manifest fields, `neo.<role>.agent.md` and `neo-` naming.
- [reference/stack-plugin-contract.md](./reference/stack-plugin-contract.md) — the core/stack split:
  the three tiers, the late-binding rule, stack-skill discovery.
- [reference/task-handoff-schema.md](./reference/task-handoff-schema.md) — the **Task** artifact that
  crosses Boundary 1: its carrier, fields, and serialization. (User-facing recipe:
  [../guides/filing-work.md](../guides/filing-work.md).)
- [reference/hook-contract.md](./reference/hook-contract.md) — the normative shape of plugin hooks:
  manifest schema, the per-shell `${PLUGIN_ROOT}` rule, and the script contract.

## guides/ — the *how* (operational)

- [guides/agent-authoring-reference.md](./guides/agent-authoring-reference.md) — the dev-time
  reference for the `master-control` forge: frontmatter fields, agent vs skill vs instruction vs
  hook.
- [guides/observability.md](./guides/observability.md) — install the logging hooks and read the
  per-agent / per-run stats to tune prompts.
- [guides/enforcement.md](./guides/enforcement.md) — the `preToolUse` hooks that block commit/push to
  `main` and non-draft PRs; their fail-closed contract and how to relax them.

## design/ — the *why* (rationale, not a contract)

- [design/framework-gap-analysis.md](./design/framework-gap-analysis.md) — Neo measured against the
  OODA / PDCA / Double-Diamond baseline: where it holds, where it's ahead, and the G1–G5 gaps.

## Who owns what

| Topic | Owner |
| --- | --- |
| Vocabulary / term definitions | [../glossary.md](../glossary.md) |
| What Neo is, the loops, the core rule | [../concepts/architecture.md](../concepts/architecture.md) |
| Loop boundaries, integration modes, KPI settlement | [../concepts/process-flow.md](../concepts/process-flow.md) |
| Framework gap analysis (OODA–PDCA baseline, G1–G5) | [design/framework-gap-analysis.md](./design/framework-gap-analysis.md) |
| Plugin folder shape, manifest fields, `neo-` naming | [reference/plugin-contract.md](./reference/plugin-contract.md) |
| Core/stack split, tiers, stack-skill discovery | [reference/stack-plugin-contract.md](./reference/stack-plugin-contract.md) |
| The Task handoff artifact | [reference/task-handoff-schema.md](./reference/task-handoff-schema.md) |
| Plugin hook manifest + script contract | [reference/hook-contract.md](./reference/hook-contract.md) |
| Authoring agents / skills / hooks | [guides/agent-authoring-reference.md](./guides/agent-authoring-reference.md) |
| Logging & prompt tuning | [guides/observability.md](./guides/observability.md) |
| `preToolUse` enforcement (block-on-main, draft-PR-only) | [guides/enforcement.md](./guides/enforcement.md) |

## Superseded — kept for history

- The pre-#34 dual-harness packaging design doc was removed when the Claude tree was dropped. Its
  live content moved to [reference/stack-plugin-contract.md](./reference/stack-plugin-contract.md).
