# todo

**GitHub Issues are the canonical backlog.** This file is a thin snapshot of the loose
ends that aren't (yet) filed as issues, plus a pointer to the tracked work. Last
reconciled 2026-07-21.

The previous version of this file was a 2026-07-19 findings dump. Almost all of it has
since landed: the core/stack plugin split (PR #33), the task-handoff schema (PR #35), and
the **Copilot-only decision** (#34, PR #36/#37) that dropped the Claude agent tree, the
`.claude-plugin/` manifests, and the dual hook configs, renaming `validate-mirrors.py` →
`validate-plugins.py`. Neo is now a **single-harness (GitHub Copilot) distribution repo**.

## Where the work is tracked

Run `gh issue list --state open` for the live backlog. Current shape:

- **Specialist stack (product, `phase: specialist`)** — #16 `neo-frontend` manifest,
  #20 React + Tailwind skill, #19 TypeScript instructions, #21 Frontend agent,
  #22 Coder→Frontend binding. This is the next milestone: neo ships the *process* today
  but zero build *capability*. Now authored once (no Claude mirror).
- **Safety / hooks** — #4 block-on-`main` pre-tool hook + exit-code policy (the logging
  hook set already ships; this is the missing enforcement).
- **Verification agents** — #14 SRE / Platform Eng (`phase: core`, not built).
- **Binding + roles** — #7 abstract-role → specialist binding scheme, #10 abstract role
  defs (revisit the interleaved-vs-phased testing question, `process-flow.md` § Boundary 2).
- **Validation** (`phase: validation`) — #23 E2E dry run, #24 Copilot install+run,
  #27 parallel Coder `/fleet`. Blocked until the specialist stack lands.
- **Docs** — #25 README + "add a specialist" template.

## Untracked loose ends (no issue yet)

- **`neo-feature-authoring` skill lacks the falsifiability gate.** The design is settled in
  `docs/process-flow.md` § "Falsifiability is a gate on KPI authoring" (metric /
  instrumentation / window / falsifier), but `SKILL.md` still treats KPIs as optional and
  says nothing about instrumentation-in-scope or the captive-population rule. Fold it in.
- **master-control model names unverified.** `neo.master-control.agent.md` recommends
  specific models ("per the Copilot learning hub") that were never confirmed. Verify
  against current docs, or replace names with selection *criteria* so they can't go stale.
- **master-control has no canonical rule.** The repo file and the Claude project custom
  instructions are near-duplicates with no sync mechanism. Declare the repo file canonical
  and state it in `AGENTS.md`.
- **README intro precision** — `README.md` still says "invoking the **business
  engineer**"; per `docs/glossary.md` the BE is a *human role*, not an invocable agent.
  The agents a BE drives are `feature-agent` and `task-planner`. Tighten the phrasing.
- **Researcher name nit** — the Copilot agent is `name: Neo Research`, off the
  `Neo <Role>` pattern every other agent follows (`Neo Researcher`). Functions fine —
  the technical-engineer allowlist references `Neo Research` too — but inconsistent.

## Design decisions parked in the docs (captured, not lost)

These aren't issues because their home is the owning doc; listed here so they're findable:

- Testing modeled two ways + Diagram 2 sub-box mislabel → `docs/process-flow.md`
  § "Drift to reconcile" and the drawing-bug note near the end.
- Consumer `AGENTS.md` as a hard prerequisite + where the integration mode is declared →
  `docs/packaging.md` (project tier) and its "Who authors the consuming repo's `AGENTS.md`?"
  open question.
- KPI falsifiability gate (design) → `docs/process-flow.md` § "Falsifiability is a gate…".
- Manual open items (pin skill names, trim `jq` field paths, confirm hook schema) →
  `docs/neo-user-manual-outline.md` § 8.

## Housekeeping

- `.gitignore` ignores `*.jsonl` repo-wide — broader than the `.agent-logs/` intent.
