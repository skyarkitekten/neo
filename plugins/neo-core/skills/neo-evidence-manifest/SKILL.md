---
name: neo-evidence-manifest
description: Use when producing, checking, or consuming proof that a task's change is correct — locking checks before implementation, running layered evidence by risk tier, writing or reading an evidence manifest, or assembling a feature's evidence pack for the Business Engineer. Defines when a validation criterion counts as proven, the risk tiers and their required evidence layers, the integrity rules, and the manifest format. Load before validating a task or gating a PR on evidence. (Draft — see docs/contributing/design/verification-loop.md.)
---

# The evidence manifest

A spec says what we wanted. It does not prove what we got. This skill defines the **evidence**
that proves a task's change satisfies its validation criteria, and the **manifest** that carries
that evidence across Boundary 2. The spec is an input; the evidence is the deliverable.

This is **validation**, which means machine execution with no human judgment. It does not replace
the Business Engineer's **verification** of a feature. It feeds it. Humans verify, machines
validate. Terms are defined in `docs/glossary.md`.

> **The model never certifies its own work.** Deterministic tools and an independent agent do.
> The builder's own tests, reports, and confidence are the *claim*, never the evidence.

## The rule

> **A validation criterion is `proven` only by a check that was locked before implementation,
> passes at head, fails at base, and ran clean from the committed tree.**

That has four parts, and each one blocks a different failure:

| Part | Blocks |
| --- | --- |
| **Locked before implementation** | The builder moving the goalposts, or writing tests around what it built instead of what was asked |
| **Passes at head** | The change not doing what was asked |
| **Fails at base** | A check that passes no matter what, so it proves nothing (a tautology, a mock asserting itself, a test that never ran the new path) |
| **Ran clean** | Evidence that depends on uncommitted files, local state, cached results, or luck (flakes) |

A criterion that misses any part is not `proven`. Report which part it missed. Don't round it up.

## Criterion status

Every validation criterion on the task gets exactly one status:

| Status | Means |
| --- | --- |
| `proven` | All four parts of the rule hold, for every layer its risk tier requires |
| `failed` | A check ran and failed at head, or an integrity rule was broken |
| `unproven` | No failure was observed, but the evidence is incomplete: no check maps to it, the check wasn't locked, it passes at base, base couldn't be run, a required layer was unavailable, or it flaked |

`unproven` is an honest state, not a softer `failed`. It still blocks the gate. Never report
`proven` because a check "probably" fails at base or because the code "clearly" does the thing.

## Risk tiers

The risk tier sets which evidence layers a criterion needs. The **Business Engineer** approves
it with the task set at Boundary 1. That is where the human reviews the verification *strategy*
rather than the code. An agent may propose a tier, never lower one. If no tier was assigned,
use **T1** and record that it was defaulted.

| Tier | Typical scope | Required layers (cumulative) |
| --- | --- | --- |
| **T0** | Docs, comments, non-behavioral config | Build + lint pass. No criterion may claim behavior. |
| **T1** | Ordinary behavior change (the default) | T0 + one **behavioral check** per criterion (unit/integration/system test) + **fails-at-base** + **static analysis** the repo already runs (type-check, lint, SAST) + **semantic review** |
| **T2** | Auth, money, data integrity, PII, concurrency, public API contracts | T1 + **property-based or generative** checks for invariants + **policy-as-code** where the repo has it + a **mutation sample** on the changed code (a few hand-made or tool-made mutants must each be killed) |
| **T3** | Safety, regulatory controls, cryptography, consensus, irreversible operations | T2 + **contracts or formal methods** (model checking, proofs, refinement types) on the critical property + a human-approved **verification strategy** recorded before implementation |

**Layers come from the repo; they are never invented.** Use the commands in the consuming repo's
`AGENTS.md` and the tooling it already has. If a required layer has no tooling in the repo, mark
that layer `unavailable` and the criterion `unproven`. Do not install a tool to fill the gap.
Missing tooling is a finding for a human.

### Three kinds of evidence

The layers fall into three kinds, and they carry different weight:

| Kind | Layers | Who decides | What it can do to a criterion |
| --- | --- | --- | --- |
| **Deterministic** | build, behavioral, static, property, policy, mutation | A tool's exit code | Prove it, or fail it |
| **Semantic** | semantic review | The independent validator agent | **Only demote.** A finding can move a criterion from `proven` to `unproven` or `failed`; nothing an agent says can move a criterion up |
| **Formal** | contracts, model checking, proofs (Dafny, TLA+, Lean, …) | The checker's exit code | Prove the property the spec states, or fail it |

**Semantic review** is the validator reading the task's What and criteria against the diff and the
locked checks, looking for what no test covers: intent the criteria imply but don't state, a check
that asserts the letter of a criterion and misses its point, behavior the diff adds that no
criterion asked for. Each one becomes a **finding** in the manifest. Semantic review is required
at T1 and above, because it is the only layer that looks for the gap between the spec and the
proof.

**Formal evidence counts on the checker's verdict, not the model's.** An agent may draft a formal
spec, but the evidence is the checker's exit code, run at head. The formal spec itself is a check:
it is locked before implementation like any other, and its statement of the property is reviewed by
a human at T3. A proof the checker never ran, or a spec weakened until it proves, is not evidence.

**Runtime evals** (LLM-graded or scenario-based checks) count as a layer only when they are
deterministic enough to pass/fail. That means a pinned model and a fixed seed, or a threshold
over N runs that is stated in the check itself. A single sampled judgment is not evidence.

## Locking checks (pre-registration)

Checks are authored **before** the feature code that satisfies them, by a different agent
instance from the one that will build it. A check is anything a machine can run to a verdict
against a criterion: unit and integration tests, property-based tests, contracts, formal specs, and
policy rules. When the checks are committed, that commit's SHA becomes the **lock SHA** and the
check files become the **locked set**.

The orchestrator records the lock in a marker in the git directory (never the working tree):
`$(git rev-parse --git-path neo-check-lock)` containing
`{"lock_sha": "<sha>", "branch": "<branch>", "paths": ["tests/checkout/", "contracts/*.dfy"]}`.
The opt-in `guard-locked-checks` hook reads that marker and denies builder edits to the locked set.
The hook is a speed bump, not proof; the integrity audit below is the control.

- The builder may **read** locked checks and must make them pass. It may not edit, delete,
  rename, skip, or weaken them.
- If a locked check is genuinely wrong, that is a **spec problem**, not a build problem. Stop and
  escalate. A human approves a **lock amendment**, and the manifest records the amendment with
  its reason and approver. An unrecorded change to a locked file is an integrity failure.
- Additional tests written during implementation are welcome. They are not locked, so on their
  own they can't move a criterion to `proven`.

## Integrity rules

Each of these is checked against the diff `base..head`. Any violation makes the manifest verdict
`fail`, whatever the checks reported:

1. **Locked set untouched.** `git diff <lock>..<head> -- <locked paths>` is empty, unless a
   recorded lock amendment covers it.
2. **No new suppressions or skips.** The diff adds no `@ts-ignore`, `eslint-disable`, `# noqa`,
   `# type: ignore`, `#pragma warning disable`, `[SuppressMessage]`, `.skip`/`xit`/`@Disabled`/
   `pytest.mark.skip`, `t.Skip`, or the stack's equivalent without a comment that justifies it.
   A justified one is listed in the manifest, not hidden.
3. **No weakened gates.** The diff doesn't relax CI config, coverage thresholds, lint rules, or
   test selection.
4. **Clean tree.** Evidence was produced from the committed `head` SHA. The working tree was
   clean, or the checks ran in a scratch export of the commit.
5. **Stable.** Each behavioral check was run at least twice at head with the same result.
   Disagreement is `flaky`, and `flaky` is `unproven`.

## The manifest

One manifest per task, produced by **Neo Validator** and returned to the orchestrator, which
places it in the draft PR body under `## Evidence`. It has two parts. The human-readable summary
comes first; the machine-readable block follows.

### Summary (Markdown)

```markdown
## Evidence

**Verdict:** pass | fail | incomplete · **Tier:** T1 · **Head:** `abc1234` · **Base:** `def5678` · **Lock:** `9a8b7c6`

| # | Validation criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | POST /api/checkout with a valid card returns 201 and creates an Order row with status=paid | proven | `tests/checkout.spec.ts:14` passes at head ×2, fails at base; tsc, eslint clean |
| 2 | ... | unproven | Passes at base — the check does not exercise the new path |

**Integrity:** locked set untouched · 0 suppressions added · tree clean · 0 flaky
**Findings:** F1 (major, c2) — criterion implies idempotent retries; no check sends the same request twice
**Gaps:** <what could not be proven and why — the list a human should read first>
```

### Machine-readable block

Wrap the block in the marker comments exactly as shown, so a CI gate can find and parse it.

````markdown
<!-- neo:evidence v0 -->
```json
{
  "schema": "neo-evidence/v0",
  "task": "https://github.com/<owner>/<repo>/issues/<n>",
  "feature": "https://github.com/<owner>/<repo>/issues/<m>",
  "tier": "T1",
  "tier_source": "be-approved | defaulted",
  "base_sha": "<sha>",
  "head_sha": "<sha>",
  "lock_sha": "<sha | null>",
  "locked_paths": ["tests/checkout.spec.ts"],
  "lock_amendments": [{ "path": "", "reason": "", "approved_by": "" }],
  "criteria": [
    {
      "id": 1,
      "text": "<verbatim from the task>",
      "status": "proven | failed | unproven",
      "evidence": [
        {
          "layer": "build | behavioral | static | property | policy | mutation | eval | semantic | formal",
          "check": "tests/checkout.spec.ts:14",
          "command": "npm test -- tests/checkout.spec.ts",
          "head": { "result": "pass | fail | flaky | not_run", "runs": 2 },
          "base": { "result": "fail | pass | not_run", "reason": "" }
        }
      ],
      "reason": "<required when status is not proven>"
    }
  ],
  "integrity": {
    "locked_set_modified": [],
    "suppressions_added": [],
    "gates_weakened": [],
    "tree_clean": true,
    "flaky": []
  },
  "findings": [
    {
      "id": "F1",
      "criterion": 2,
      "kind": "uncovered-intent | weak-check | unrequested-behavior | spec-gap",
      "severity": "blocker | major | minor",
      "detail": "<what the validator saw, with a locator>",
      "outcome": "pending | confirmed | refuted"
    }
  ],
  "attempt": 1,
  "layers_unavailable": [],
  "gaps": [],
  "verdict": "pass | fail | incomplete",
  "produced_by": "Neo Validator"
}
```
<!-- /neo:evidence -->
````

**Verdict:** `pass` when every criterion is `proven`, every integrity rule holds, and no
`blocker` or `major` finding is open. `fail` when any criterion is `failed` or any integrity rule
is broken. `incomplete` otherwise. Only `pass` opens the Boundary 2 gate. A `minor` finding
doesn't block; it travels in the PR for the human to read.

**The manifest is a claim until a machine re-runs it.** An agent-produced manifest follows the
same discipline as `neo-evidence-standard`: every status needs a locator (check path, command,
SHA). The strong form of the gate is a CI job that re-executes the manifest's commands at
`head_sha` and fails if any result differs. Until that job exists, the manifest is labeled
agent-produced, and a human treats it as one.

## The feature evidence pack (Boundary 3)

When every task under a feature has merged (see the integration modes in
`docs/concepts/process-flow.md`), the task manifests are rolled up into one **evidence pack** for
the Business Engineer. It never replaces the feature's verification steps. It tells the BE where
machine proof is strong and where their judgment has to work hardest.

```markdown
## Evidence pack — <feature title>

| Verification step (the contract) | Supporting tasks / criteria | Machine evidence |
| --- | --- | --- |
| <step, verbatim> | #12 c1, c2 · #14 c1 | All proven (T1) |
| <step, verbatim> | #13 c3 | **Thin** — 1 criterion unproven; no T2 property check |
| <step, verbatim> | — | **None** — rests entirely on BE judgment |

**Read first:** <steps with thin or no machine evidence>
**Trace:** PRD segment → feature #<m> → tasks #12, #13, #14 → manifests (linked) → squash commit
```

A verification step with **no** supporting criterion isn't a defect in itself; some outcomes only
a human can judge. A step whose support is all `unproven` is worth flagging to the BE before
they start.

## Routing a failed manifest

Diagnose at task grain, the same way Boundary 3 diagnoses at feature grain:

| Finding | Meaning | Routes to |
| --- | --- | --- |
| **Mis-built** | Locked checks are right; the code doesn't satisfy them | Coding loop: back to the writer, findings verbatim |
| **Mis-checked** | The locked check doesn't express its criterion (passes at base, asserts the wrong thing) | Coding loop: a new check unit, re-locked, with the amendment recorded |
| **Mis-specified** | The criterion itself is wrong, contradictory, or not machine-checkable | Specification loop: `task-planner`, BE re-approves |

Never fix a failure by editing a locked check without a recorded amendment. That is the
goalpost moving.

**Send evidence, not "fix it".** A failed manifest goes back to the builder with the failing
check, command, output, and finding, verbatim. The builder needs to see what broke, not a summary
of the validator's opinion.

**Cap the retries.** Each validation run increments `attempt`. Escalate to a human, with the
manifests from every attempt, when either of these happens:

- **3 attempts** on one task without a `pass`, or
- the **same criterion fails for the same reason twice** with no change in its evidence (the same
  stall rule the review loop uses).

A capped loop is a finding in its own right. It usually means the check or the criterion is
wrong, not that the builder needs one more try.

## The findings ledger

A validator is itself an agent, so its instructions need tuning against outcomes. Every finding
carries `outcome: pending`. When a human settles it, by fixing it, dismissing it, or a later
defect proving it right, the outcome becomes `confirmed` or `refuted`, with a link to the
evidence. Over time the ledger tells you:

- **Precision**: the share of findings that were confirmed. Low precision means the validator
  cries wolf, and people learn to skim it.
- **Escapes**: defects found after merge, at verification or in production, that a criterion
  covered but no finding flagged. These are the validator's misses.
- **By kind**: which finding kinds earn their keep, and which instructions to sharpen or cut.

Change the validator's instructions from ledger evidence, never from a single memorable miss.

## Never

- Never mark a criterion `proven` without a check, a locator, and a head **and** base result.
- Never treat a check that passes at base as evidence for a new behavior.
- Never install tools, add dependencies, or invent commands to complete a layer. Record it as `unavailable`.
- Never edit a locked check, or accept an edit to one, without a recorded lock amendment.
- Never let a manifest verdict stand that contradicts its own integrity block.
- Never let a semantic finding, or anything else an agent says, promote a criterion to `proven`.
- Never count a formal proof the checker didn't run at head.
- Never present the evidence pack as the verification. The BE still runs the steps.
