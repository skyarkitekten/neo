# todo

Findings from a full read of the repo (2026-07-19). Ordered by severity. Not yet triaged or scheduled.

---

## 1. Copilot orchestrator lacks the tools its body requires

`.github/agents/neo.technical-engineer.agent.md` declares `tools: ['search']`, but its
procedure requires creating a feature branch (phase 3) and opening a draft PR (phase 5).
No `runCommands`, no git/github tooling. Phases 3 and 5 cannot execute.

The Claude mirror (`agents/neo-technical-engineer.md`) has `Bash, Task` and is fine.

**Fix:** grant the Copilot orchestrator the tools for branch + PR, or narrow its documented
scope to research/plan only and say so in the body.

## 2. Broken `agents:` allowlist entry

Same file: `agents: ['Neo Researcher', ...]`. The researcher's actual frontmatter `name:` is
**`Neo Researcher Agent`** (`.github/agents/neo.researcher.agent.md`). The name doesn't match,
so delegation to the researcher won't route.

**Fix:** reconcile — either drop `Agent` from the researcher's `name`, or correct the
allowlist. Prefer the former; every other agent's name is `Neo <Role>`.

## 3. The two agent trees have diverged

| Agent | `.github/agents/` (Copilot) | `agents/` (Claude) |
| --- | --- | --- |
| code-reviewer | ✅ | ✅ |
| code-writer | ✅ | ✅ |
| feature-agent | ✅ | ✅ |
| implementation-planner | ✅ | ❌ — still named `neo-planner.md` |
| master-control | ✅ | ✅ |
| researcher | ✅ | ✅ |
| task-planner | ✅ | ❌ **missing entirely** |
| technical-engineer | ✅ | ✅ |

The Implementation Planner rename (commit `4a1a9c6`) landed only on the Copilot side.
`docs/plugin-contract.md` § "Known drift → Agent roster mismatch" already documents this.

**Fix:** mirror `neo.task-planner.agent.md` → `agents/neo-task-planner.md`; rename
`agents/neo-planner.md` → `agents/neo-implementation-planner.md` and update its `name:`.
Then clear the entry from Known drift.

## 4. Skills ship Copilot-only

`task-authoring` and `feature-authoring` live in `.github/skills/`. There is no top-level
`skills/` tree, and `.claude-plugin/plugin.json` declares no skills path.

But the Claude-side agents instruct: *"Load it. Do not restate its rules here; conform to
them."* On Claude Code those skills don't exist, so `neo-feature-agent` and the (missing)
task-planner would run with their governing rules absent.

**Fix:** decide — mirror skills to a top-level `skills/` and declare them in
`.claude-plugin/plugin.json`, or make the Claude-side agents self-contained. Mirroring is
consistent with the dual-manifest rule in `docs/plugin-contract.md`.

## 5. Root `AGENTS.md` describes a different repo

It's the unfilled React/Bun + .NET 10 template, TODO block intact. Every agent points to it
as "the source of truth for commands, layout, and style." An agent operating *inside* neo is
told to run `bun run test` against a repo that is markdown, bash, and python.

**Open question:** is this deliberately a shipped template for consuming repos, or an
oversight? If deliberate, it's in the wrong place — move it to `assets/` or `templates/` and
write a real `AGENTS.md` describing neo itself.

## 6. No `preToolUse` / `PreToolUse` hook exists

`neo-technical-engineer`, `AGENTS.md`, and the manual outline all state that never-commit-to-
`main` "must also be enforced at the harness level (via permissions or a `preToolUse` hook) —
don't treat this line as the safeguard."

Neither `hooks/hooks.json` (Claude) nor `.github/hooks/hooks.json` (Copilot) registers a
pre-tool event. The enforcement those files promise doesn't exist.

**Fix:** write the block-on-`main` hook for both harnesses. Mind the exit-code divergence —
Copilot denies on any non-zero except `2`; Claude Code blocks on `2`.

## 7. README is stale

- Names agents that don't exist: `orchestrator`, `planner`. Actual roster is in § 3 above.
- Links `docs/manual-outline.md`; the file is `docs/neo-user-manual-outline.md`.
- References invoking "the **business engineer**" — no agent by that name. BE is a *human
  role* per `docs/glossary.md`; the agents a BE drives are `feature-agent` and `task-planner`.

## 8. `docs/architecture.md` contradicts the repo

Its Status / Open threads sections say the root `AGENTS.md` "does not exist yet; neo is
currently README + LICENSE only." It exists, as do agents, skills, hooks, and manifests.

## 9. Uncommitted work sitting on `main`

Untracked: `.github/agents/neo.feature-agent.agent.md`, `.github/skills/feature-authoring/`,
`agents/neo-feature-agent.md`. Modified: `docs/architecture.md`, `docs/glossary.md`,
`docs/plugin-contract.md`.

All on `main`, against the project's own rule. Move to a feature branch.

## 10. Verify model names in `master-control`

`agents/neo-master-control.md` and its Copilot mirror recommend `Claude Sonnet 4`,
`GPT-5.6`, `kimi-k2.7-code`, `GPT-4.1`, `GPT-4.1-mini`. These are cited as "per the Copilot
learning hub" but unverified. An agent will act on this list.

**Fix:** verify against current Copilot docs, or replace the specific names with selection
*criteria* so the guidance can't go stale.

---

## Lower priority / open

- `.github/copilot-hooks.template.json` is superseded by `.github/hooks/hooks.json`; README
  already calls it "the older, hand-wired hook example." Delete it or state why it stays.
- `.gitignore` ignores `*.jsonl` repo-wide — broader than the `.agent-logs/` intent.
- Open items already tracked in `docs/neo-user-manual-outline.md` § 8 (pin skill names, trim
  `jq` field paths in `log-event.sh`, confirm Copilot hook schema) overlap this list —
  reconcile into one source of truth rather than two.
