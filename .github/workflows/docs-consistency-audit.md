---
emoji: 📚
name: Docs Consistency Audit
description: Weekly audit checking AGENTS.md, README, and docs/ for drift against the actual plugins/ layout and the normative plugin contract.
on:
  schedule: weekly
  workflow_dispatch:
permissions:
  contents: read
  copilot-requests: write
strict: true
safe-outputs:
  create-issue:
    title-prefix: "Docs Consistency Audit:"
    labels: [docs-audit]
    close-older-issues: true
    expires: 30
---

# Docs Consistency Audit

## Task

Audit this repository's documentation for drift against its actual structure and its own normative contract.

1. Read `docs/contributing/reference/plugin-contract.md` — this is the **normative** source of truth for plugin folder shape, manifest fields, and naming (`neo.<role>.agent.md` files, `name: Neo <Role>` frontmatter, `neo-` skill prefixes).
2. Enumerate the actual contents of `plugins/*/` (agents, skills, plugin manifest, hooks config) using shell commands as needed.
3. Compare the actual layout against the contract and flag:
   - Agent files that don't follow `neo.<role>.agent.md` naming, or whose `name:` frontmatter doesn't match `Neo <Role>`.
   - Skills that aren't `neo-` prefixed (excluding explicitly vendored/upstream skills that keep their upstream name).
   - Missing or malformed required fields in `plugin.json` / `hooks.json`.
4. Cross-check top-level docs — `AGENTS.md`, `README.md`, `docs/README.md`, `docs/getting-started.md`, `docs/glossary.md`, `docs/concepts/*.md`, `docs/guides/*.md`, `docs/contributing/README.md`, `docs/contributing/reference/stack-plugin-contract.md` — for statements that contradict the current repo layout, including:
   - References to removed trees (`.claude/`, `.claude-plugin/`, or dev-time root `agents/`/`skills/` described as shipped).
   - File or folder paths mentioned in docs that no longer exist in the repo.
   - Internal markdown links (`[text](path)`) that point to files that don't exist.
5. Run `python3 scripts/validate-plugins.py` and include any failures verbatim in the report.

## Report Scope

This is a structural snapshot audit of the current repository state, not a time-windowed activity report — always evaluate the full current `docs/` and `plugins/` tree as of the run, not deltas since a previous run.

## Report Format

Group findings under:

- `### Naming Violations`
- `### Manifest Issues`
- `### Stale Doc References`
- `### Broken Links`
- `### validate-plugins.py Output` (only include this section if the script failed)

Use `<details><summary>...</summary>` for long file listings or verbose script output. Keep the overview and critical issues visible without expanding.

## Safe Outputs

- Use `create-issue` to publish the audit report when at least one finding exists in any category.
- Call `noop` with a short explanation (e.g. "all docs consistent with plugins/ layout and plugin-contract.md") when no issues are found across all categories.
