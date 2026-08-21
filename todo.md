# todo

**GitHub Issues are the canonical backlog.** This file is a thin snapshot of the loose
ends that aren't (yet) filed as issues, plus a pointer to the tracked work. Last
reconciled 2026-08-20.

The previous version of this file was a 2026-07-19 findings dump. Almost all of it has
since landed: the core/stack plugin split (PR #33), the task-handoff schema (PR #35), and
the **Copilot-only decision** (#34, PR #36/#37) that dropped the Claude agent tree, the
`.claude-plugin/` manifests, and the dual hook configs, renaming `validate-mirrors.py` →
`validate-plugins.py`. Neo is now a **single-harness (GitHub Copilot) distribution repo**.

Since then: `preToolUse` enforcement shipped (#42, PR #44), and the **Product loop** shipped
as a second plugin, `neo-product` (PR #70, plus `product.researcher` in PR #71) — five agents
and three skills producing a PRD upstream of the Specification loop.

## Where the work is tracked

Run `gh issue list --state open` for the live backlog. Current shape:

- **Specialist stack (product, `phase: specialist`)** — #16 `neo-frontend-react` manifest,
  #20 React + Tailwind skill, #19 TypeScript instructions, #21 Frontend agent,
  #22 Coder→Frontend binding. This is the next milestone: `neo-core` alone builds and
  runs the process fine, but ships no stack plugin yet — no language/framework skills for
  `code-writer`/`code-reviewer` to select by description when the work is React,
  TypeScript, or any other named technology. Now authored once (no Claude mirror).
  `neo-core` itself stays language- and technology-agnostic; users can add or swap stack
  plugins freely. Neo's own "bread-and-butter stack" — the plugins Neo ships and
  maintains out of the box — is: `neo-frontend-react` (#16), `neo-frontend-angular`
  (#65), `neo-csharp-api` (#66), `neo-azure-platform` (#67), and `neo-ops` (#68, pairs
  with #14 Verification agents).
- **Safety / hooks** — #4 core observability hook set + per-session enablement. The
  `preToolUse` enforcement half (block-on-`main`, draft-PR-only) is **done** — #42, PR #44.
  #75 tracks duplicate hook registration now that two plugins each ship the same nine events.
- **Docs tooling** — #76 add undocumented-plugin and Neo-stylization checks to the Docs
  Consistency Audit; blocked on gh-aw v0.83.1 to recompile the workflow lock file.
- **Verification agents** — #14 SRE / Platform Eng (`phase: core`, not built).
- **Binding + roles** — #7 abstract-role → specialist binding scheme, #10 abstract role
  defs (revisit the interleaved-vs-phased testing question, `process-flow.md` § Boundary 2).
- **Validation** (`phase: validation`) — #23 E2E dry run, #24 Copilot install+run,
  #27 parallel Coder `/fleet`. Blocked until the specialist stack lands.
- **Docs** — #25 README + "add a specialist" template.

## Untracked loose ends (no issue yet)

- **`neo-feature-authoring` skill lacks the falsifiability gate.** The design is settled in
  `docs/concepts/process-flow.md` § "Falsifiability is a gate on KPI authoring" (metric /
  instrumentation / window / falsifier), but `SKILL.md` still treats KPIs as optional and
  says nothing about instrumentation-in-scope or the captive-population rule. Fold it in.
  This is the back-door slice of **G2** in
  `docs/contributing/design/framework-gap-analysis.md`; that doc also flags the untracked front-door
  question (should Boundary 1 carry a testability gate?) plus gaps G1, G3–G5.
- **master-control model names unverified.** `neo.master-control.agent.md` recommends
  specific models ("per the Copilot learning hub") that were never confirmed. Verify
  against current docs, or replace names with selection *criteria* so they can't go stale.
- **master-control has no canonical rule.** The repo file and the Claude project custom
  instructions are near-duplicates with no sync mechanism. Declare the repo file canonical
  and state it in `AGENTS.md`.

## Design decisions parked in the docs (captured, not lost)

These aren't issues because their home is the owning doc; listed here so they're findable:

- Testing modeled two ways + Diagram 2 sub-box mislabel → `docs/concepts/process-flow.md`
  § "Drift to reconcile" and the drawing-bug note near the end.
- Consumer `AGENTS.md` as a hard prerequisite + where the integration mode is declared →
  `docs/contributing/reference/stack-plugin-contract.md` (project tier) and its "Who authors the consuming repo's `AGENTS.md`?"
  open question.
- KPI falsifiability gate (design) → `docs/concepts/process-flow.md` § "Falsifiability is a gate…".
- Framework gap analysis (OODA–PDCA baseline; gaps G1–G5 vs the backlog; strategic-reopen,
  front-door-gate, and single-BE open questions) → `docs/contributing/design/framework-gap-analysis.md`.
- Loop plugins as a packaging axis on the Process tier (`neo-core` is the baseline; a loop
  plugin ships per optional loop; opt-in install) →
  `docs/contributing/reference/stack-plugin-contract.md` § "Loop plugins".
- Manual open items (pin skill names, trim `jq` field paths, confirm hook schema) → folded into the
  user docs (`docs/getting-started.md`, `docs/guides/using-neo.md`); the old
  `docs/guides/neo-user-manual-outline.md` stub was retired in the IA restructure.

## Housekeeping

- `.gitignore` ignores `*.jsonl` repo-wide — broader than the `.agent-logs/` intent.
