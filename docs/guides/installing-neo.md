# Installing Neo

For the **integrator** — the person dropping Neo into a repo so a team can use the crew. If you
just want to drive agents that are already installed, see
[using-neo.md](./using-neo.md); if you want to change Neo itself, see
[../contributing/README.md](../contributing/README.md).

> **Status:** the plugin, its agents, and the authoring skills are `[live]`. The autonomous Coding
> and Verification loops they will eventually feed are `[target]` — see
> [getting-started.md](../getting-started.md#whats-live-vs-target).

## 1. Install the plugin

Neo ships for GitHub Copilot CLI as a marketplace plugin. The marketplace is `neo`; the baseline
plugin is `neo-core`.

```
copilot plugin marketplace add skyarkitekten/neo
copilot plugin install neo-core@neo
```

Copilot then reads the plugin's agents (`agents/*.agent.md`), skills
(`skills/`), and hooks (`hooks/hooks.json`). You don't wire these by hand — the
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

## 4. Add the Product loop (optional)

`neo-core` starts at a PRD. If your team doesn't have one — or wants to work the problem before
committing to a solution — install the Product loop:

```
copilot plugin install neo-product@neo
```

It adds the **Neo Product Engineer** orchestrator plus Product Researchers and the viability /
desirability / feasibility lenses, and it ends at a PRD the BE accepts. It is **upstream of**, not
a replacement for, `feature-agent` and `task-planner`. Skip it if a PRD already exists.

This is a **loop plugin** — Process-tier capability packaged separately because the loop itself is
optional. See
[../contributing/reference/stack-plugin-contract.md](../contributing/reference/stack-plugin-contract.md).

## 5. Add a stack (optional)

`neo-core` handles the process; **stack plugins** (e.g. a React or .NET plugin) carry the
tech-specific skills a coder uses *inside* a task. Every project installs `neo-core`; stacks are
additive and late-bound. The core/stack split — the three tiers and how stack skills are discovered
at runtime — is owned by
[../contributing/reference/stack-plugin-contract.md](../contributing/reference/stack-plugin-contract.md).

## 6. Verify the install

- The agents appear in Copilot's agent picker (look for `Neo <Role>` names, e.g. **Neo Technical
  Engineer**).
- Nothing is blocked. Neo ships **no** enforcement hook: the guardrail scripts that block
  commit/push to `main` and non-draft PRs are in the plugin but deliberately not registered, so
  installing Neo changes no permissions. Branch policy is your team's call — enforce it with
  server-side branch protection, and opt the hooks in on top if you want them locally.
  [../contributing/guides/enforcement.md](../contributing/guides/enforcement.md) explains why and
  how to opt in.
- Optionally, turn on logging to tune prompts from real runs:
  [../contributing/guides/observability.md](../contributing/guides/observability.md).

Once installed, hand off to [using-neo.md](./using-neo.md) to start driving the crew.

## Troubleshooting: every tool call is denied

This affects already-installed `neo-core` 2.1.0 and `neo-product` 2.0.5 on some Windows clients.
The symptom is this error on every tool call, including read-only calls such as `view`:

```text
Denied by preToolUse hook from "neo-core@neo" (hook errored)
```

If `neo-product` is installed, the plugin name may be `neo-product@neo`. In VS Code, the same
root cause can show up as a warning that mentions `log-event.ps1`.

**Cause.** Windows execution policy blocks the hook script from loading. The hook then fails, and a
failed `preToolUse` hook denies the tool call.

Confirm the failing case with:

```powershell
pwsh -NoProfile -Command "Get-ExecutionPolicy -List"
```

On a Windows client, if every scope is `Undefined`, the effective policy is `Restricted`, which is
the case that blocks the script.

Fixes, best first:

1. **Upgrade** to `neo-core` 2.2.0 or later and `neo-product` 2.1.0 or later. These versions no
   longer register the hook. Restart the Copilot session after upgrading: a mid-session
   `copilot plugin install` does not re-read hook manifests, and plugin installs use a physical copy
   rather than reading this repo live.
2. If you cannot upgrade yet, allow local scripts for your Windows user:

   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   ```

   `CurrentUser` needs no admin rights. `RemoteSigned` allows local scripts to run and requires
   downloaded scripts to be signed.
3. Or uninstall the plugins and restart:

   ```console
   copilot plugin uninstall neo-core
   copilot plugin uninstall neo-product
   ```

`NEO_ENFORCE_GUARDRAILS=0` will not help here. That setting is read by the hook script, and in this
failure the script never loads.

On Group-Policy-managed Windows machines, `-ExecutionPolicy` flags cannot override
`MachinePolicy` or `UserPolicy`. If those scopes block scripts, option 2 may not be available; use
option 1 or 3 instead. For the full technical story, see
[enforcement.md](../contributing/guides/enforcement.md).
