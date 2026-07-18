# Agent Authoring Reference

Condensed reference for the **Master Control** forge. Distills three sources so agent/skill/instruction/hook authoring can follow current conventions without re-fetching:

- Building Custom Agents — <https://awesome-copilot.github.com/learning-hub/building-custom-agents/>
- Agents and Subagents — <https://awesome-copilot.github.com/learning-hub/agents-and-subagents/>
- AGENTS.md open spec — <https://agents.md/>

> Sourced Jul 2026. Copilot frontmatter fields and version-gated behavior change often — treat version notes as approximate and verify against the target Copilot/VS Code version before relying on them.

---

## 1. Custom agents (`*.agent.md`)

A Markdown file that gives Copilot a **persona + tool access + guardrails + model preference** for a whole session. Selected explicitly (agent picker or `@mention`), persists across the conversation, stored in `.github/agents/`, shared with the team.

**How it differs from siblings:** agents are chosen and persistent; instructions apply passively to matching files; skills are single-task capabilities an agent can invoke. Use an agent for an interactive multi-step workflow, an instruction for standing standards, a skill for a focused repeatable task.

### Anatomy

Two parts: YAML frontmatter + Markdown body (the system prompt).

**Frontmatter fields:**

| Field | Status | Purpose |
| --- | --- | --- |
| `name` | recommended | Display name in the picker. |
| `description` | **required** | What it does / when to pick it — drives discovery and routing. |
| `model` | recommended | Which model powers it; match to task complexity. |
| `reasoningEffort` | optional — **Copilot CLI only** (v1.0.66+) | Pin `low`/`medium`/`high` regardless of the user's global setting. Ignored by VS Code and the GitHub.com cloud agent. |
| `tools` | recommended | Allowlist of built-in tools + MCP servers. |
| `agents` | optional | Allowlist of worker agents this one may launch (needs the `agent` tool). |
| `handoffs` | optional | VS Code handoff buttons — **ignored on GitHub.com cloud agent**. |
| `user-invokable` / `user-invocable` | optional | Whether a human can select it directly. |
| `disable-model-invocation` | optional | Prevent use as a subagent unless a coordinator allows it. |
| `argument-hint` | optional | Hint for invocation args — **ignored on GitHub.com cloud agent**. |
| `target` | optional | `vscode` or `github-copilot`; omit for both. |

Common built-in tools: `codebase`/`search`, `terminal`/`runCommands`, `edit`, `github`, `fetch`/`web`, `agent`. MCP tools are referenced by server name (e.g. `postgres`, `docker`).

**Body:** structure it — role/expertise, a numbered procedure or checklist, guardrails ("never…"), and an explicit output format (show the format you expect).

### Design patterns

- **Domain expert** — deep knowledge of one technology, security-first defaults.
- **Workflow automator** — executes a multi-step process (e.g. release manager); asks for confirmation before irreversible steps.
- **Quality gate** — enforces standards (accessibility, API design); returns severity-tagged findings.

### Best practices & pitfalls

- Be specific about expertise ("React 18+ with TypeScript", not "frontend dev"). Define working style (ask vs. assume; concise vs. thorough). Include guardrails. Show output examples.
- Choose the model to fit the task; use higher reasoning for review/analysis, lighter models for formatting/simple tasks.
- **One persona per file.** If an agent sprawls, split it or extract shared work into skills.
- Start with 2–3 agents; typical teams run 3–8.
- Pitfalls: too broad ("you are a software engineer"); no `tools` declared; **contradicting instruction files**; monolithic do-everything agents.

---

## 2. Agents and subagents (orchestration)

**Agent** = primary assistant for the session (user-selected, persistent, talks to the user). **Subagent** = temporary worker another agent launches for a narrow task (isolated context, reports back, then disappears).

**Why delegate:** context isolation (worker sees only its task prompt), focused role instructions, parallelism, controlled synthesis by the parent, and per-worker model selection. This is why decomposed multi-agent setups beat one monolithic agent on large tasks. Skip subagents when the work is small and needs no decomposition.

### Wiring it (VS Code)

- Coordinator needs the `agent` tool plus an `agents:` allowlist of the workers it may call.
- Workers are usually hidden (`user-invocable: false`) and can set `disable-model-invocation: true`.
- **Nesting is off by default** — subagents don't spawn subagents unless `chat.subagents.allowInvocationsFromSubagents` is enabled.

### Entry points (Copilot CLI)

- `/fleet` — orchestrator that decomposes an objective, launches parallel background subagents, respects dependencies, synthesizes. Subagents share one filesystem, so avoid overlapping writes.
- `/research` — built-in research orchestrator/subagent pattern.
- Prompt-mode caveat: with `copilot -p "…"`, **repo hooks are disabled by default** for security; opt in with `GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS=true`.
- Concurrency/depth limits configurable from `/settings` (v1.0.66+).

### Patterns that work

Coordinator + worker · multi-perspective parallel review (correctness / security / architecture) · research-then-act.

### Platform nuance — delegation isn't universal

- **VS Code**: subagents, allowlists, `handoffs`.
- **Copilot CLI**: orchestration via `/fleet`, `/research`.
- **GitHub.com cloud agent**: supports custom agents but **ignores `handoffs` and `argument-hint`**.

If files are shared across surfaces, document which behaviors are portable vs. editor-specific.

---

## 3. AGENTS.md — the open spec

A "README for agents": a predictable place for the build/test/convention context agents need, kept separate from the human README. Open format (stewarded by the Agentic AI Foundation), used across 60k+ projects and a broad tool ecosystem (Copilot, Codex, Cursor, Jules, Aider, Zed, Gemini CLI, and more) — so one file serves many agents.

- **No required fields.** Plain Markdown; use whatever headings help. Popular sections: project overview, build & test commands, code style, testing instructions, security considerations, PR/commit guidelines.
- **Agents run the commands you list** and attempt to fix failures before finishing — so list exact, runnable checks.
- **Nested files for monorepos:** the closest AGENTS.md to the edited file wins; each subproject can ship tailored instructions.
- **Precedence:** nearest AGENTS.md wins over parent; an explicit user chat prompt overrides everything.
- Treat it as living documentation.

---

## Quick decision guide

| Need | Reach for |
| --- | --- |
| Standing, passive rules on matching files | Instruction file (`*.instructions.md`, `applyTo` glob) |
| Repeatable focused task with bundled assets | Skill (`SKILL.md`) |
| A persistent persona for a whole workflow | Agent (`*.agent.md`) |
| Coordinate several specialists / parallel tracks | Coordinator agent (`agent` tool + `agents:` allowlist) |
| Project-wide build/test/style/guardrails | Root `AGENTS.md` (nested for monorepo subtrees) |
| Guaranteed enforcement outside the model | Hook (lifecycle event) |
