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

1. Read `docs/contributing/reference/plugin-contract.md` — this is the **normative** source of truth for plugin folder shape, manifest fields, and naming (`neo.<role>.agent.md` or `neo.<domain>.<role>.agent.md` files, a `name:` frontmatter that starts with `Neo ` and unambiguously identifies the agent, `neo-` skill prefixes). See §4 of the contract; `name:` need not be a mechanical transform of the filename.
2. Enumerate the actual contents of `plugins/*/` (agents, skills, plugin manifest, hooks config) using shell commands as needed.
3. Compare the actual layout against the contract and flag:
   - Agent files that don't follow the §4 filename grammar (`neo.<role>.agent.md`, or `neo.<domain>.<role>.agent.md` in a multi-domain plugin), or whose `name:` frontmatter doesn't start with `Neo ` or doesn't unambiguously identify that agent. Do not require `name:` to be an exact mechanical transform of the filename.
   - Skills that aren't `neo-` prefixed (excluding explicitly vendored/upstream skills that keep their upstream name).
   - Missing or malformed required fields in `plugin.json` / `hooks.json`.
4. Cross-check top-level docs — `AGENTS.md`, `README.md`, `docs/README.md`, `docs/getting-started.md`, `docs/glossary.md`, `docs/concepts/*.md`, `docs/guides/*.md`, `docs/contributing/README.md`, `docs/contributing/reference/stack-plugin-contract.md` — for statements that contradict the current repo layout, including:
   - References to removed trees (`.claude/`, `.claude-plugin/`, or dev-time root `agents/`/`skills/` described as shipped).
   - File or folder paths mentioned in docs that no longer exist in the repo.
   - Internal markdown links (`[text](path)`) that point to files that don't exist.
5. Run `python3 scripts/validate-plugins.py` and include any failures verbatim in the report.
6. Check plugin documentation coverage. List the plugin directories at run time with a shell command (for example `ls -d plugins/*/`); never assume a fixed set of plugins.
   - **Forward check.** Each plugin must appear in `docs/getting-started.md`, `docs/guides/installing-neo.md`, `README.md`, and in at least one **Ships in** cell of the **What ships** table in `docs/contributing/reference/stack-plugin-contract.md`. Find that table by its heading and its `Artifact | Ships in | Notes` header row, not by line number; a Ships in cell may list several comma-separated values, and the Artifact and Notes cells do not count. Match the plugin name as a whole token: a longer name that only starts with the plugin name (such as a skill named after the plugin plus a suffix) does not count. Mentions inside fenced code, inline code, install targets (`<plugin>@neo`), and paths (`plugins/<plugin>/`) do count. Report each uncovered plugin once, naming every required doc or the What ships table it is missing from.
   - **Reverse check.** In the same four docs, flag a `neo-*` name presented as a currently shipped or installable plugin — an install command or `<name>@neo` target, a Ships in value, a `plugins/<name>/` path described as existing, or a list of shipped plugins — when no `plugins/<name>/` directory exists. Report the file and line, the name, and why the text reads as shipped. Do not flag names framed as examples, hypothetical, illustrative, planned, future, or placeholders (including `<...>` placeholders and example-install blocks); historical, migration, or past-release notes; skill or agent names (check `plugins/*/skills/` and `plugins/*/agents/` before treating a `neo-*` token as a plugin); non-plugin Ships in values such as "nothing"; heading anchors; or URLs.
7. Check Neo stylization in prose. Read the **Neo, stylized.** paragraph in `docs/glossary.md` and apply it exactly as written; that paragraph owns the rule, so cite it in every finding instead of restating it. Check `AGENTS.md`, `README.md`, and every `docs/**/*.md` file. Apply the paragraph's code-fence and inline-code rule to fences indented inside list items and to `mermaid` blocks as well. Also skip YAML frontmatter, link and image destinations, bare URLs, HTML comments, and the glossary paragraph itself, which quotes the forms it forbids. Report each violation as the file and line, the offending text, and the suggested replacement.

## Report Scope

This is a structural snapshot audit of the current repository state, not a time-windowed activity report — always evaluate the full current `docs/` and `plugins/` tree as of the run, not deltas since a previous run.

## Report Format

Group findings under:

- `### Naming Violations`
- `### Manifest Issues`
- `### Stale Doc References`
- `### Broken Links`
- `### Undocumented Plugins` (step 6 forward check)
- `### Stale Plugin Claims` (step 6 reverse check)
- `### Stylization` (step 7; cite the **Neo, stylized.** paragraph in `docs/glossary.md` as the rule owner)
- `### validate-plugins.py Output` (only include this section if the script failed)

Use `<details><summary>...</summary>` for long file listings or verbose script output. Keep the overview and critical issues visible without expanding.

## Safe Outputs

- Use `create-issue` to publish the audit report when at least one finding exists in any category.
- Call `noop` with a short explanation (e.g. "all docs consistent with plugins/ layout and plugin-contract.md") when no issues are found across all categories. The explanation must state how many plugins and required docs the coverage check examined and how many files the stylization check examined (e.g. "all docs consistent with plugins/ layout and plugin-contract.md; coverage checked P plugins against 4 required docs; stylization checked F files").
