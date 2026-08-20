# neo-product

**Status: scaffold, design confirmed.** Folder shape and manifests exist; the shape of the
loop is decided (see below and [issue #69](https://github.com/skyarkitekten/neo/issues/69)),
but the agent/skill files themselves are still stubs. Do not install for real use until
`neo.product-engineer.agent.md` is replaced with a specced system prompt.

## What this plugin is

`neo-product` ships the **Product loop** — a new loop upstream of the existing Specification
loop. Today neo's `PRD -> Specification` boundary
([`process-flow.md`](../../docs/concepts/process-flow.md)) assumes a PRD/requirements
document simply exists; this loop is what produces it. It is **upstream of**, not a
replacement for, `neo-core`'s specification crew (`feature-agent`, `task-planner`, the BE) —
the PRD this loop emits is what the BE then segments into features.

## Shape

- **Orchestrator:** `neo.product-engineer.agent.md` — the Product Engineer agent.
- **Phases** — not a strict pipeline; these run in parallel or on demand:
  - **Intake / Onboarding**
  - **System & Design -> PRD** — the phase that emits the PRD artifact
  - **Ingest Code & Docs** — parallel/on-demand, not fixed first or last
- **Sub-capabilities** — separate invokable agents/skills the Product Engineer calls, not
  prompt sections of one agent:
  - `Researcher` — invoked as parallel sub-agents (fan-out for research), not multiple
    distinct researcher roles
  - `Systems Thinking`
  - `Product Thinking`
  - `Design Thinking`
- **Output:** a PRD, crossing the existing `PRD -> Specification` boundary unchanged.

## What's inside

- **Agents** (`.github/agents/`, `neo.<role>.agent.md`):
  - `neo.product-engineer.agent.md` — placeholder stub (`user-invocable: false`,
    `disable-model-invocation: true`) pending the system prompt described above. See the
    file for what must be decided before it ships.
- **Skills** (`.github/skills/`): none yet — the sub-capability agents/skills above are not
  yet authored.
- **Hooks** (`.github/hooks/hooks.json`, v1 schema, `${PLUGIN_ROOT}`): the same
  fail-open observability logging and fail-closed guardrail enforcement as `neo-core`,
  via this plugin's own `.agent-hooks/log-event.{sh,ps1}` and
  `.agent-hooks/enforce-guardrails.{sh,ps1}` (duplicated, not shared — plugins cannot
  reference files outside their own directory; see
  [`plugin-contract.md`](../../docs/contributing/reference/plugin-contract.md#1-plugin-folder-shape)).

## Why a new plugin and not a `neo-core` addition

`docs/contributing/reference/stack-plugin-contract.md` treats a domain wanting its own agent
as a signal to check first, not a routine extension. Answer recorded here: the Product loop
is a distinct phase that runs *before* the Specification loop begins — it does not fit the
process/technology/project tiers `neo-core` already owns, and it does not replace or absorb
`feature-agent`/`task-planner`. It therefore ships as its own plugin rather than as an
addition to `neo-core`'s specification crew.

## Install

Not yet ready to install as a functioning crew. Once designed, packaging follows the same
path as `neo-core`:

```
copilot plugin marketplace add skyarkitekten/neo
copilot plugin install neo-product@neo
```

## License

MIT
