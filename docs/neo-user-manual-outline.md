# Neo User Manual — Outline

> Highlights only. This is a skeleton to flesh out into the full manual later.

## 1. Overview

- What this is: a spec-to-PR multi-agent coding system.
- Target harness: GitHub Copilot (primary), Claude Code (backup/portable).
- Repo it serves: React/TypeScript (Vite, Bun) `frontend/`, .NET 10 C# `backend/`.
- Core loop: GitHub Issue / Azure DevOps story → research → plan → implement → review → draft PR.

## 2. Project context — `AGENTS.md`

- Repo-root file both harnesses read; the source of truth for layout, commands, style.
- Layout map, per-layer commands (Bun frontend, dotnet backend), enforceable style rules.
- Hard rules up top: never commit to `main`; work on a feature branch.
- Finish gate: build + lint + tests pass before done.
- Template placeholders to fill: test frameworks, Gotchas (env vars, FE→BE wiring, codegen).

## 3. The agents (`.github/agents/*.agent.md`)

- **orchestrator** — user-invokable coordinator. Owns the flow; delegates every phase; opens the draft PR. Never writes/reviews itself.
- **researcher** — read-only; answers one scoped question. Run several in parallel.
- **planner** — read-only; turns spec + research into an ordered unit list, marks parallelizable vs dependent.
- **code-writer** — implements one labeled unit ("implement feature" or "implement test"). Worker, not user-invokable.
- **code-reviewer** — reviews one change (feature or test); applies the right checks per type. Worker.
- Design principles: sharp single job each; workers don't know each other or the spec; orchestrator wires them.

## 4. Workflow phases

- **Research** — split spec into questions, fan out researchers, stop and ask if underspecified.
- **Plan** — planner produces labeled/sequenced units mapped to acceptance criteria.
- **Implement** — create feature branch; delegate units; parallelize independent ones.
- **Review** — reviewer per unit; loop findings (verbatim) back to writer until approved.
- **Submit** — draft PR linked to the spec; left for a human to merge.

## 5. Skills

- Agents load skills for the tech in scope (React, TypeScript, .NET/C#) — both auto-trigger and named.
- Tool access provided per project via helper skills (mix of MCP and CLI).
- TODO: pin exact skill names so triggering is reliable.

## 6. Conventions & guardrails

- Branch-per-spec: `feat/<issue-id>-<short-name>` / `fix/...`.
- Never commit to `main`; never merge — end at a draft PR.
- Real enforcement is harness-level (permissions or a `preToolUse` hook), not just the prompt.
- CI runs fmt + lint (not duplicated in hooks).

## 7. Observability & tuning (hooks)

- `log-event.sh` — fail-open JSONL logger; one record per lifecycle event.
- Configs: Claude `hooks/hooks.json`, Copilot `.github/hooks/hooks.json` (both shipped in `plugins/neo-core/`).
- `analyze_agent_logs.py` — per-agent tool/event/time stats; per-run duration + review-round counts.
- Tuning loop: log real runs → analyze → fix the worst-performing `.agent.md` → compare next batch.
- Correlation via `AGENT_RUN_ID` (defaults to git branch).

## 8. Open items / to verify

- Confirm Copilot hook + agent frontmatter schema (event names, `agents`/`user-invokable`, config location) against installed version.
- Set real test frameworks and commands in `AGENTS.md` (e.g. Vitest, xUnit).
- Trim `jq` field paths in `log-event.sh` to the harness's actual payload.
- Pin skill names.
- Optional: token/cost capture; `preToolUse` enforcement hooks (block-on-main, draft-PR-only).
- Pending: chain-of-verification review pass on each file.
