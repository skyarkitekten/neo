# Installing Neo

For the **integrator** — the person dropping Neo into a repo so a team can use the crew. If you
just want to drive agents that are already installed, see
[using-neo.md](./using-neo.md); if you want to change Neo itself, see
[../contributing/README.md](../contributing/README.md).

> **Status:** the plugin, its agents, and the authoring skills are `[live]`. The autonomous Coding
> and Verification loops they will eventually feed are `[target]` — see
> [getting-started.md](../getting-started.md#whats-live-vs-target).

## 1. Install the plugin

Neo ships for GitHub Copilot CLI as a marketplace plugin. The marketplace is `neo`; the shipped
plugin is `neo-core`.

```
copilot plugin marketplace add skyarkitekten/neo
copilot plugin install neo-core@neo
```

Copilot then reads the plugin's agents (`.github/agents/*.agent.md`), skills
(`.github/skills/`), and hooks (`.github/hooks/hooks.json`). You don't wire these by hand — the
plugin manifest does. The exact folder shape and manifest fields are normative in
[../contributing/reference/plugin-contract.md](../contributing/reference/plugin-contract.md);
you only need it if something doesn't resolve.

## 2. Give your repo an `AGENTS.md`

`neo-core` is stack-agnostic. It learns *your* project from a repo-root **`AGENTS.md`** — the file
the Copilot harness reads as the source of truth for layout, commands, and style. This is **your
artifact**, distinct from Neo's own `AGENTS.md`. It should carry:

- **Layout** — where the code lives, per area.
- **Commands** — how to build, lint, and test each layer (the finish gate: build + lint + tests
  pass before a unit is done).
- **Style** — enforceable conventions.
- **Guardrails** — never commit or push to `main`; work on a feature branch; end at a **draft** PR.
- **Commit conventions** — the coding loop commits one commit per unit in
  [Conventional Commits](https://www.conventionalcommits.org/) form. Your `AGENTS.md` may define its
  own scopes and extra types, but stays within that format.
- **Integration mode** — how Neo work enters your repo (see below).
- **Gotchas** — env vars, cross-layer wiring, codegen steps.

For rules that should apply to *some* files rather than the whole repo, add
`.github/instructions/<name>.instructions.md` with an `applyTo` glob. These are yours too — Neo
cannot ship them, because Copilot finds instruction files by location and a plugin's install
directory isn't one of the places it looks.

## 3. Choose an integration mode

Neo attaches to your project in one of two modes (**A** or **B**). The choice changes how a Task
enters the repo and who owns the branch. The modes and the "two fits" that decide which suits your
project are owned by
[../concepts/process-flow.md § Integration modes](../concepts/process-flow.md). Record the chosen
mode in your `AGENTS.md` so every agent reads it the same way.

## 4. Add a stack (optional)

`neo-core` handles the process; **stack plugins** (e.g. a React or .NET plugin) carry the
tech-specific skills a coder uses *inside* a task. Every project installs `neo-core`; stacks are
additive and late-bound. The core/stack split — the three tiers and how stack skills are discovered
at runtime — is owned by
[../contributing/reference/stack-plugin-contract.md](../contributing/reference/stack-plugin-contract.md).

## 5. Verify the install

- The agents appear in Copilot's agent picker (look for `Neo <Role>` names, e.g. **Neo Technical
  Engineer**).
- The guardrail hooks are active — an attempt to commit to `main` is blocked. That enforcement, and
  how to relax it deliberately, is documented in
  [../contributing/guides/enforcement.md](../contributing/guides/enforcement.md).
- Optionally, turn on logging to tune prompts from real runs:
  [../contributing/guides/observability.md](../contributing/guides/observability.md).

Once installed, hand off to [using-neo.md](./using-neo.md) to start driving the crew.
