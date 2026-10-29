---
name: neo-evidence-standard
description: Use whenever an agent gathers, cites, forwards, or consumes evidence — research findings, market or competitive claims, statistics, prior decisions, or anything destined for a PRD, feature, or slide. Defines the retrieval-or-silence rule, the FACT/INFERENCE/RECALL labels, locator formats, and the verified retrieval methods for this harness. Load it before reporting findings and before synthesizing someone else's.
---

# The evidence standard

A research finding is only worth the retrieval behind it. This skill exists because you shipped a research report full of confident "HIGH FACT" claims that were **recalled training data with fake citations**. You made up data points and benchmark figures and cited publications that did not exist. This was caught right before it was shared with executives; they would have fired you on the spot.

That is the failure mode this standard prevents. Practitioners know their own figures. A wrong number does not merely fail to land **it discredits every true thing around it.**

## The rule

> **A claim is a fact only if you retrieved an artifact this session that says so.**
> **Everything else is recall, and recall is labeled, never cited.**

Two corollaries, both absolute:

- **A URL you did not fetch is not a citation.** Never emit a URL you have not opened this session.
  Never produce a publication name, report title, author, organization, figure, percentage, or date
  from memory and dress it as sourced.
- **If you cannot retrieve it, you cannot claim it.** Say the gap out loud. An honest "unknown" is a
  usable input; a confident guess corrupts every downstream lens and everyone who trusts them.

## The three labels

Every claim you report carries exactly one, visibly:

| Label                 | Means                                                 | Requires                                                        |
| --------------------- | ----------------------------------------------------- | --------------------------------------------------------------- |
| `FACT`                | You retrieved an artifact this session that states it | A locator — see below                                           |
| `INFERENCE`           | You derived it from one or more labeled `FACT`s       | The derivation, shown, plus the facts it rests on               |
| `RECALL — UNVERIFIED` | It came from training data                            | A knowledge-cutoff caveat, and it is **not usable as a number** |

`RECALL — UNVERIFIED` is a legitimate label, not a failure — it is often the honest state of a claim,
and stating it plainly is exactly the behavior this standard wants. What is forbidden is _laundering_
it into `FACT`. Recall is a lead to go verify, never a citation, and never a number anyone acts on.

An unlabeled claim is a defect. A downstream agent must reject the report, not guess the label.

### Locator formats

| Source        | Locator                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------- |
| This repo     | `path/to/file.md:42`                                                                         |
| The web       | The exact URL you fetched, the retrieval method, and the sentence you are relying on, quoted |
| GitHub        | `#123`, or the commit `sha`                                                                  |
| A prior agent | The agent name **and that claim's original label** — see propagation below                   |

## Numbers get the strictest bar

Every statistic, percentage, currency figure, market size, growth rate, and date is held to `FACT` or
it does not ship.

- A number with no fetched source is **deleted, not softened.** Do not hedge it into "roughly" or
  "industry estimates suggest" — that preserves the falsehood and hides its origin.
- Quote the source's own words for the figure, and carry its units, date, population, and methodology.
  A number stripped of what it measured is not evidence.
- If the figure matters and you cannot retrieve it, report the gap as a decision the human must make:
  _"this rests on a number I could not source."_

## Labels propagate

When you consume another agent's findings, **their labels travel with the claim.** You may not promote
`RECALL — UNVERIFIED` to `FACT` because it appeared in a report, was repeated by two agents, or reads
plausibly. Only new retrieval promotes a label — and then you cite _your_ retrieval, not their
confidence.

This is the laundering path that produced the GS1 failure: a researcher's recall became an
orchestrator's input, and an input became a synthesized "finding".

## Retrieval in this harness

Retrieval requires the `execute` tool. **In Copilot CLI the `web` and `search` tool aliases are
silently ignored** — declaring them grants nothing (see
`docs/contributing/guides/agent-authoring-reference.md`). Shell is the working path.

Verified on Windows/PowerShell on 2026-08-27 — re-verify rather than trusting this list, since
availability changes and the shell differs per platform:

| Method                                                          | Status                        | Caveat                                                                                                                                                                                                           |
| --------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct fetch — `curl -sL <url>`                                 | Works                         | On Windows PowerShell call `curl.exe` explicitly — bare `curl` is an alias for `Invoke-WebRequest` and takes different flags. Some sites block non-browser agents; check for a login or consent wall in the body |
| `r.jina.ai` proxy — `https://r.jina.ai/<url>`                   | Works, returns clean Markdown | **Returns a cached snapshot.** It reports its own `Published Time`; read it, and re-fetch directly if currency matters                                                                                           |
| DuckDuckGo HTML — `https://html.duckduckgo.com/html/?q=<query>` | Works, returns real results   | CAPTCHA-walling is intermittent; if the body contains an anomaly or challenge page, treat the search as failed rather than reading results into it                                                               |
| GitHub — `gh` CLI                                               | Works, authenticated          | Prefer it over scraping github.com                                                                                                                                                                               |

Shell is `powershell` on Windows and `bash` elsewhere — do not hardcode either.

**Retrieval is not success.** A 200 response can be a paywall, a consent interstitial, a soft 404, or
a CAPTCHA. Read what came back before you cite it. If the body does not contain the sentence you are
relying on, you have not retrieved your claim.

## Reporting shape

```markdown
- **FACT** — Onboarding writes directly to `users` without validation.
  `src/onboarding/service.ts:88`

- **FACT** — GS1 defines the on-shelf availability KPI as [exact quoted sentence].
  https://www.gs1.org/<real-path-you-actually-opened> (direct fetch, `curl -sL`)

- **INFERENCE** — The validation gap likely explains the duplicate-account reports.
  From the fact above plus the duplicate handling in `src/onboarding/service.ts:120`.
  Not confirmed against production data.

- **RECALL — UNVERIFIED** — Retail out-of-stock rates are often cited near 8%.
  Training data, cutoff-bound. I could not retrieve a primary source. **Not usable as a figure** —
  if this number matters, it needs sourcing before it appears anywhere.

- **GAP** — No documented owner for the onboarding flow. Searched `docs/`, `AGENTS.md`, and
  issue history; nothing found.
```

## Never

- Never invent, complete, or "reconstruct" a citation, URL, title, author, or date.
- Never attach a real organization's name to a claim you did not retrieve from that organization.
- Never present a `RECALL` claim as `FACT` because it is probably true, widely believed, or repeated.
- Never let a number reach a PRD, feature, or slide without a fetched locator.
- Never silently reconcile contradicting sources — report the contradiction; it is usually the finding.
- Never treat retrieval failure as license to fall back on memory. Report the gap instead.
