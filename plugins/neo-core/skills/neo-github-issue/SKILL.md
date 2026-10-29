---
name: neo-github-issue
description: Use when a spec arrives as a GitHub Issue reference — an issue URL, `owner/repo#<n>`, or `#<n>` — and must be read before branching, research, or planning. Detects the spec provider from the input, fetches the issue with `gh` (body, labels, state, comments, parent, sub-issues, blockers, linked PRs), extracts acceptance criteria without inventing any, and returns the provider-neutral normalized spec the Technical Engineer and its workers consume. Load at Coding-loop spec intake.
---

# Reading a GitHub Issue as a spec

The spec is the requirements. This skill turns a GitHub Issue reference into one **normalized spec** object so every downstream phase — branch naming, research questions, planning against acceptance criteria, the PR's `Closes` link — reads the same fields the same way, whichever provider the spec came from.

Retrieve, don't recall. Every field comes from a `gh` call made in this session; if a call fails, the field takes its empty value and the failure is recorded in `warnings`, never filled from memory or guesswork. Load `neo-evidence-standard` alongside this skill — the normalized spec is a `FACT` whose locator is the issue URL.

## 1. Detect the provider

Classify the input before fetching anything. Trim whitespace and surrounding `<>`/quotes first. A GitHub reference always resolves to four parts — `<host>`, `<owner>`, `<repo>`, `<n>` — and **`<host>` is carried through every later call and into the normalized `id`**, so a GitHub Enterprise issue is never looked up on github.com.

| Input | Provider | Resolves to |
| --- | --- | --- |
| `https://<host>/<owner>/<repo>/issues/<n>` (optionally with `#issuecomment-…` or a query string), where `<host>` is `github.com` or a host `gh auth status` reports | `github` | all four parts from the URL |
| `<owner>/<repo>#<n>` | `github` | `<owner>`, `<repo>`, `<n>`; `<host>` is the current repo's host (below) when run inside a GitHub repo, else `github.com` |
| `#<n>` | `github` | the current repo — `gh repo view --json nameWithOwner,url --jq '"\(.url \| split("/")[2]) \(.nameWithOwner)"'` prints `<host> <owner>/<repo>` |
| `https://dev.azure.com/<org>/<project>/_workitems/edit/<id>`, `https://<org>.visualstudio.com/…/_workitems/edit/<id>`, or `AB#<id>` | `azure-devops` | the Azure DevOps intake skill — see below |
| bare `<n>` (no `#`) | ambiguous | see below |

- **A pull-request URL (`…/pull/<n>`) is not a spec.** Stop and ask for the issue it implements.
- **Bare number.** Azure DevOps work items are referenced by bare id, GitHub issues by `#<n>`. Check `git remote -v`: only GitHub remotes (`github.com` or a known GHE host) → treat it as `#<n>` and add the warning `bare number interpreted as GitHub issue #<n>`; only Azure DevOps remotes (`dev.azure.com`, `*.visualstudio.com`) → `azure-devops`. Both, neither, or no repo → ask the user which provider they mean.
- **Azure DevOps is not handled here.** Its intake skill is tracked in [skyarkitekten/neo#39](https://github.com/skyarkitekten/neo/issues/39) and **is not available yet**. If the provider is `azure-devops` and no Azure DevOps intake skill is loaded, stop and tell the user so — don't improvise a field mapping. The consumer continues only if the user explicitly accepts an unnormalized read. When the skill ships, it returns the same shape (§4).

## 2. Fetch

Preflight: `gh auth status --hostname <host>` must succeed. If it doesn't, stop and tell the user to run `gh auth login`. Use `gh` through the shell — in Copilot CLI the `github/*` MCP tool names grant nothing.

Fetch the issue in one call. `<R>` is `<owner>/<repo>` when `<host>` is `github.com`, and `<host>/<owner>/<repo>` otherwise — never drop the host for GHE:

```bash
gh issue view <n> --repo <R> --json \
number,title,body,url,state,stateReason,labels,issueType,comments,\
parent,subIssues,blockedBy,blocking,closedByPullRequestsReferences
```

- `parent`, `subIssues`, `blockedBy`, `blocking`, `closedByPullRequestsReferences`, and `issueType` need a recent `gh` (verified on 2.102). If `gh` rejects any field as unknown, retry with the baseline fields only — `number,title,body,url,state,stateReason,labels,comments` — and fetch parent and sub-issues over REST (every `gh api` call passes `--hostname <host>`; without it `gh api` defaults to `github.com`):
  - Parent: `gh api --hostname <host> repos/<owner>/<repo>/issues/<n>/parent --jq '{number,title,state,url:.html_url}'`. HTTP 404 `No parent issue found` means no parent, not an error.
  - Sub-issues: `gh api --hostname <host> --paginate repos/<owner>/<repo>/issues/<n>/sub_issues --jq '.[] | {number,title,state,url:.html_url}'`.
  - Anything still unavailable (blockers, closing PRs, issue type) takes its empty value, with a warning naming what couldn't be fetched.
- If `subIssues.totalCount` exceeds the number of `subIssues.nodes` returned, page the REST sub-issues endpoint for the rest.
- Not found or no access (`Could not resolve to an Issue`, HTTP 404/403): stop and report the exact error. Never guess the issue's content.
- Linked items can live in other repos. Build each item's `id` from its own URL (host included when it isn't `github.com`), not from the current repo.

## 3. Extract acceptance criteria

Acceptance criteria are what the planner maps units to and what the PR claims to meet. Extract them; **never author them.**

1. **Named section first.** Find a Markdown heading (any level, case-insensitive, trailing `:` ignored) whose text is `Acceptance criteria`, `Validation criteria`, `Definition of done`, or `AC`. Its items run until the next heading of the same or higher level. Each list item (`- `, `* `, `1. `, with or without `[ ]` / `[x]`) becomes one criterion; indented continuation lines join their item, and nested sub-bullets stay inside their parent's text. `[x]` → `done: true`, `[ ]` → `done: false`, a plain bullet → `done: null`. Set `acceptance_criteria_source` to `section:<heading text>`. If the section holds prose but no list, take each non-empty paragraph as one criterion and add the warning `acceptance criteria section has no list — paragraphs taken as criteria`.
   - `Validation criteria` is the Neo task carrier's name for this list (the canonical task body has `## Parent feature`, `## What`, `## Validation criteria`, `## Depends on`); it **is** the acceptance criteria.
2. **Otherwise, task lists.** If there is no such section but the body has task-list items (`- [ ]` / `- [x]`), take them all, set `acceptance_criteria_source` to `checklist`, and add the warning `acceptance criteria inferred from body task list — not a named criteria section; the consumer routes the task back before branching`.
3. **Otherwise, none.** `acceptance_criteria: []`, `acceptance_criteria_source: "none"`.

Rules:

- Keep each criterion's text verbatim — strip only the list marker and checkbox. Don't rephrase, merge, split, or "clarify".
- Criteria proposed only in **comments** are not acceptance criteria. Mention them in `comments_summary` and add the warning `comments propose acceptance criteria not in the body` — the user decides whether they count.
- `missing_acceptance_criteria` is `true` exactly when `acceptance_criteria` is empty. The consumer then stops before branching — a task carrier is routed back to the Specification loop — and this skill never fills the gap.

## 4. The normalized spec

Return exactly this shape. It is **provider-neutral**: the Azure DevOps intake skill (#39) returns the same fields, so consumers read one contract. The normative definition is Neo's `docs/contributing/reference/task-handoff-schema.md` § 6 *Normalized spec*; this copy must be kept in step with it, because a plugin can't reference files outside itself.

```json
{
  "provider": "github",
  "id": "skyarkitekten/neo#41",
  "number": 41,
  "url": "https://github.com/skyarkitekten/neo/issues/41",
  "title": "Add a skill for reading GitHub Issues as specs",
  "type": "issue",
  "state": "open",
  "state_reason": null,
  "description": "<body Markdown, verbatim>",
  "acceptance_criteria": [
    { "text": "Resolves a GitHub Issue from a URL or `#<n>` and returns the normalized spec fields.", "done": false }
  ],
  "acceptance_criteria_source": "section:Acceptance criteria",
  "missing_acceptance_criteria": false,
  "labels": ["enhancement"],
  "parent": null,
  "sub_items": [],
  "related": [
    { "relation": "mentioned", "id": "skyarkitekten/neo#39", "url": "https://github.com/skyarkitekten/neo/issues/39", "title": null, "state": null }
  ],
  "comments_count": 0,
  "comments_summary": "",
  "warnings": []
}
```

Field mapping for GitHub:

| Field | Type | GitHub source |
| --- | --- | --- |
| `provider` | `"github"` \| `"azure-devops"` | always `"github"` here |
| `id` | string | `<owner>/<repo>#<number>` on `github.com`; `<host>/<owner>/<repo>#<number>` on GitHub Enterprise — the cross-reference form, host kept |
| `number` | integer | `number` — for branch names (`feat/<number>-<slug>`) and `Closes #<number>` |
| `url` | string | `url` |
| `title` | string | `title`, verbatim |
| `type` | string | `issueType.name` lowercased if set, else `"issue"` |
| `state` | `"open"` \| `"closed"` | `state` lowercased |
| `state_reason` | string \| null | `stateReason` lowercased (`completed`, `not_planned`, `reopened`); `null` if empty |
| `description` | string | `body`, verbatim, AC section included |
| `acceptance_criteria` | `{text, done}[]` | §3; `done` is `true` \| `false` \| `null` |
| `acceptance_criteria_source` | string | `section:<heading>` \| `checklist` \| `none` |
| `missing_acceptance_criteria` | boolean | `acceptance_criteria` is empty |
| `labels` | string[] | `labels[].name` |
| `parent` | item \| null | `parent` (or REST `/parent`); failing that, the link under a `## Parent feature` body section, with the warning `parent taken from body` |
| `sub_items` | item[] | `subIssues.nodes` (or REST `/sub_issues`) |
| `related` | `{relation, id, url, title, state}[]` | `blockedBy.nodes` → `blocked-by`; `blocking.nodes` → `blocks`; `closedByPullRequestsReferences` → `closed-by-pr`; items under a `## Depends on` body section → `depends-on`; other issue/PR references in the body → `mentioned`. `title`/`state` are `null` when not fetched. Don't repeat the parent or a sub-item here. |
| `comments_count` | integer | length of `comments` |
| `comments_summary` | string | below; `""` when there are no comments |
| `warnings` | string[] | every fallback, inference, truncation, contradiction, or failed call |

An *item* is `{ "id", "url", "title", "state" }`, `state` lowercased.

Every top-level key is always present. A relationship that couldn't be retrieved takes its empty value (`null` for `parent`, `[]` for lists) and gets a `warnings` entry. If the issue itself can't be fetched, return no object — report the error instead (§2).

**Comments summary.** A few attributed sentences (`@login`, date) covering decisions that change or narrow scope, answered open questions, proposed acceptance criteria, and blockers. Quote short phrases verbatim where wording matters; skip bot noise and "+1"s. The summary is a reading aid — the body remains the requirements — and a comment that contradicts the body goes in `warnings` for the user to resolve.

## 5. Hand-off

- Report the normalized spec as a fenced `json` block, then one line each for: missing acceptance criteria (yes/no), warning count, and the issue URL.
- `state: "closed"` → confirm with the user before working a closed issue.
- `missing_acceptance_criteria: true`, or criteria inferred from a checklist → the consumer stops before branching; for a task carrier it checks the required fields and the `be-approved` label and routes back if either is missing. A warning that criteria were contradicted → the consumer asks the user before planning. Don't invent requirements.
- Pass the whole object to every worker that needs the spec; workers never see the issue themselves.
