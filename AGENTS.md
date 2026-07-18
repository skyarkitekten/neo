# AGENTS.md

A React frontend and a .NET backend.

> **Template — set before use.** The commands and rules below are sensible defaults for this stack, not verified against your repo. Before relying on this file, **specify your test frameworks and their exact commands**: frontend (e.g. Vitest via `bun run test`) and backend (e.g. xUnit / NUnit via `dotnet test`). A wrong test command breaks the agent's build-and-test loop.

## Layout

```
frontend/   React + TypeScript, built with Vite, package manager is Bun
backend/    .NET 10 Web API in C#
```

- Work in the folder for the layer you're changing. A nested `frontend/AGENTS.md` or `backend/AGENTS.md`, if present, overrides this file for that subtree.
- **Never commit or push to `main`.** All work happens on a feature branch. This must also be enforced at the harness/permission level (or a pre-commit hook) — do not rely on this line alone.
- Do not edit build output: `frontend/dist/`, `backend/**/bin/`, `backend/**/obj/`.

## Frontend (`frontend/`)

Use **Bun**, never npm/yarn/pnpm. Run all commands from `frontend/`.

```bash
bun install       # install deps
bun run dev       # Vite dev server
bun run build     # production build (tsc + vite build)
bun run lint      # lint
bun run test      # tests (Vitest) — replace if your framework differs
```

Run tests with `bun run test` (a package.json script), not `bun test` (Bun's built-in runner, which won't pick up Vitest config).

- TypeScript is strict — no `any`, no unchecked nulls. Fix type errors; don't suppress with `// @ts-ignore`.
- Function components with hooks only. No class components.
- Keep imports absolute from the configured alias if one exists; otherwise relative.

## Backend (`backend/`)

.NET 10, C#. Run all commands from `backend/` (or point `--project` at the target project).

```bash
dotnet restore
dotnet build
dotnet run                    # run the API
dotnet test                   # run tests
dotnet format                 # apply code style
```

- Use `async`/`await` for I/O; suffix async methods with `Async`.
- Enable and honor nullable reference types; don't silence warnings with `!` unless provably safe.
- Prefer dependency injection over static/singleton access.

## Before you finish

- Frontend changes: `bun run build`, `bun run lint`, and `bun run test` pass.
- Backend changes: `dotnet build` and `dotnet test` pass; run `dotnet format`.
- Fix failures rather than working around them. Never leave a broken build or failing tests, and never commit to `main`.

## Gotchas

<!-- TODO: fill in project-specific facts an agent can't infer, e.g.:
- Required env vars and where they're set (.env, user secrets)
- How the frontend reaches the backend (proxy config, base URL)
- Any code generation step (OpenAPI client, EF migrations) and when to run it
-->
