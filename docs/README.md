# Neo docs

The design record and manual for the **Neo Agentic SDLC**. These docs serve two audiences — people
who **use** Neo and people who **contribute** to it. Pick a door below. The main docs speak to
users; contributor material lives in one subtree so you never have to wade through it to get work
done.

> **Status key:** `[live]` — built today · `[target]` — end-state design, not yet built. Neo ships
> more design than code right now; the markers keep the docs honest. See
> [getting-started.md § What's live vs. target](./getting-started.md#whats-live-vs-target).

## Shared core — read first, whichever door you take

- [`glossary.md`](./glossary.md) — the canonical vocabulary. Everything assumes these terms.
- [`concepts/architecture.md`](./concepts/architecture.md) — what Neo is: task = spec, the three
  loops, the verify/validate rule.
- [`concepts/process-flow.md`](./concepts/process-flow.md) — the loop boundaries: what artifact
  crosses each gate, who owns it, integration modes, KPI settlement.

## 🚪 I want to USE Neo

Start at **[`getting-started.md`](./getting-started.md)** — what Neo is, what's live, and the
quickest path in. Then:

- [`guides/installing-neo.md`](./guides/installing-neo.md) — install `neo-core`, write your project's
  `AGENTS.md`, pick an integration mode, add a stack.
- [`guides/using-neo.md`](./guides/using-neo.md) — invoke the crew and work the Specification loop
  with the Business Engineer.
- [`guides/filing-work.md`](./guides/filing-work.md) — what a well-formed Feature and Task look like
  before they enter the pipeline.

## 🔧 I want to work ON Neo

Start at **[`contributing/README.md`](./contributing/README.md)** — the contributor hub. It covers:

- **Contracts** (`contributing/reference/`) — plugin shape, core/stack split, task-handoff schema,
  hook contract.
- **Authoring & operations** (`contributing/guides/`) — agent authoring, observability,
  enforcement.
- **Design rationale** (`contributing/design/`) — the framework gap analysis.

## The one rule (both doors)

**Define a thing once, in its owning doc, and link to it.** Don't restate. Each hub carries the
owner table for its half; the shared-core owners are:

| Topic | Owner |
| --- | --- |
| Vocabulary / term definitions | [`glossary.md`](./glossary.md) |
| What Neo is, the loops, the core rule | [`concepts/architecture.md`](./concepts/architecture.md) |
| Loop boundaries, integration modes, KPI settlement | [`concepts/process-flow.md`](./concepts/process-flow.md) |

Repo-level layout, checks, and guardrails for working on Neo itself live in the root
[`AGENTS.md`](../AGENTS.md), not here. None of `docs/` ships in a plugin.