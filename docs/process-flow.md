# Process Flow — Loop Boundaries

How work crosses from the **Specification loop** to the **Coding loop** to the **Verification
loop**, and back. Terms in **bold** are defined in the [glossary](./glossary.md); the loops
themselves are described in [architecture.md](./architecture.md).

**Scope of this document.** This maps the *boundaries* — what artifact crosses, what gate it
must clear, who owns the gate, and where it goes when it fails. The internals of the Coding
and Verification loops remain `[target]` and are not specced here.

**Status key:** `[live]` designed and drafted · `[target]` end-state design, not yet specced.

---

## The chain

| # | Boundary | Artifact that crosses | Gate | Gate owner | Status |
| --- | --- | --- | --- | --- | --- |
| — | PRD → Specification | PRD/requirements segment | Segment has a business justification | BE | `[live]` |
| **1** | **Specification → Coding** | One **Task** | Task-authoring conformance + BE-approved task set | BE (human) | `[live]` |
| **2** | **Coding → Verification** | One draft **PR** | **Validation** green + code review approved | Machine, then human | `[target]` |
| **3** | **Verification → Deployment** | One verified **Feature** | **Verification** steps pass | BE (human judgment) | `[target]` |
| — | Deployment → Operations | Deployed feature | CD + smoke test pass | Platform Eng Agent | `[target]` |

The unit changes at every boundary. That is the point, and it is also where the seams are:
the spec loop thinks in **features**, the coding loop thinks in **tasks**, and the
verification loop thinks in **features** again. Boundary 2 is therefore not 1:1 — N task PRs
fan in to one verifiable feature. How that assembly happens is the
[integration mode](#integration-modes), a project-level choice with a neo default.

---

## Boundary 1 — Specification → Coding

`[live]` on the emitting side; the receiving side needs reconciliation (see Drift).

**What crosses.** Exactly one **Task**: the spec-level unit, derived from exactly one
BE-signed feature, sized to roughly one pull request, carrying machine-checkable validation
criteria. The task is self-contained — a Coder needs no further business input to work it.

**Entry gate.** All must hold:

1. The parent **Feature** is BE-signed and carries What + Why + verification steps.
2. The task conforms to the `neo-task-authoring` skill — title, parent-feature link, What, and
   validation criteria that are machine-checkable.
3. The task belongs to a **BE-approved task set**, not an agent-emitted one. Feature→Task
   decomposition is interactive and converges with the BE; a task from an unapproved split
   does not cross.

**Gate owner.** The BE. This is a human gate by design — a bad split poisons everything
downstream, so no agent may open it alone.

**On rejection.** A task that fails the gate does not get patched in the coding loop. A gap
in the task goes back to the `task-planner`; a gap in the *feature* goes back to the BE and
the `feature-agent`. Downstream agents never invent scope to fill a hole — that rule is
already binding in `neo.task-planner.agent.md` and `neo-code-writer.md`.

**Drift to reconcile.** `neo-technical-engineer` declares its input as "a GitHub Issue or
Azure DevOps story." The spec loop emits a **Task**. These need to be the same object: a neo
Task should *be* the issue/story it is filed as, so the orchestrator's input contract and the
task-planner's output contract describe one artifact rather than two. Until that is stated,
the boundary has no defined carrier.

---

## Boundary 2 — Coding → Verification

`[target]`.

**What crosses.** One **draft pull request** implementing one task, with its validation
criteria green.

**Entry gate.** All must hold:

1. **Validation passes** — the task's machine-checkable criteria run to a deterministic pass.
   No human judgment participates in this gate; that is the definition of validation.
2. **Build, lint, and tests pass** for every layer the change touched.
3. **Code review approved** by the reviewer agent, for both the feature/fix units and the
   test units.
4. The PR is linked to its parent task, and through it to the parent feature.

**Gate owner.** Machine first (validation), then the reviewer agent, then a human on the PR.
The PR stays a **draft** — no agent marks it ready or merges it.

**On rejection.** A reviewer's findings loop back inside the coding loop — passed verbatim to
the writer, re-reviewed, repeated until approved. This is an *internal* loop and does not
cross the boundary. Only a stalled loop (the same finding twice with no progress) escalates
to a human.

**The fan-in.** One PR closes one task. **Verification is per-feature.** So crossing this
boundary with a single PR is necessary but not sufficient — the verification loop cannot start
until *every* task under the parent feature has landed. What performs that assembly is the
project's [integration mode](#integration-modes).

**Drift to reconcile.** Diagram 2 draws `Testing` as its own phase after `Implement`, but
`neo-implementation-planner` emits test units interleaved with feature units and
`neo-code-writer` implements whichever it is assigned. Two different models of the same phase.
Pick one before speccing the coding loop internals: phase-separated testing, or interleaved
labeled units.

---

## Boundary 3 — Verification → Deployment

`[target]`.

**What crosses.** One **verified Feature** — all child tasks merged, and the feature's
verification steps executed and passed.

**Entry gate.** The BE executes the feature's **verification steps** in a non-prod
environment and renders a pass/fail judgment on each. These steps are *the contract*, authored
at feature-definition time. If the BE cannot verify it, it does not deploy.

**Gate owner.** The BE, exercising human judgment. This is the inverse of Boundary 2's
machine gate, and deliberately so: **verify features, validate tasks; humans verify, machines
validate.**

**On rejection — the triage.** A failed verification does not carry its own diagnosis. It says
the feature does not behave as expected; it does not say why. Resolving that is a **human
investigation step, and a first-class part of this loop** — not a routing decision an agent
infers from the failure.

The investigation returns one of three findings:

| Finding | Meaning | Routes to |
| --- | --- | --- |
| **Mis-built** | The contract is correct; the implementation does not satisfy it. | **Coding loop** — new task under the same, unchanged feature. |
| **Mis-specified** | The contract itself is wrong, incomplete, or names the wrong outcome. What was built may faithfully satisfy it. | **Specification loop** — `feature-agent`, re-sign the feature. |
| **Both** | The contract is wrong *and* the implementation does not satisfy even the contract as written. | **Specification loop first**, then Coding. See ordering rule. |

**Ordering rule for "both."** Fix the specification before the implementation. Re-signing the
feature can change what "built correctly" means, so code written against the old contract may
be work thrown away — or worse, work that passes and entrenches the wrong behavior. Spec
first, then re-decompose, then build. Never run the two repairs in parallel.

**Gate owner.** The BE owns the investigation and the routing call. Both must be explicit and
recorded. Defaulting a failed verification to "write more code" is precisely how a
mis-specified feature gets built twice.

**Record with every rejection:**

- Which verification step failed.
- Observed behavior vs. the behavior the contract promised.
- The finding — mis-built, mis-specified, or both — and the evidence for it.
- Where it routed, and what changed as a result.

This record is the loop's learning signal. A feature that comes back mis-specified twice is
telling you something about the Specification loop, not about the coders.

---

## Feedback edges

Three edges run backward. Only the first is currently designed.

**Review → Implement** `[live]` — inside the coding loop. Reviewer findings return to the
writer verbatim. Bounded: a repeated finding with no progress escalates to a human.

**Verification → Coding or Specification** `[target]` — Boundary 3 rejection, routed by BE
diagnosis as above.

**Operations → Specification** `[target]` — the long edge, and the one nothing in the repo
currently draws. A feature's **KPIs** are authored as a hypothesis; that hypothesis is only
settleable in production, from **telemetry**, after the window closes. Operations owes the
Specification loop a verdict on every feature that shipped with KPIs. See
[The two fits](#the-two-fits) — this edge carries the second one.

---

## The two fits

Verification and KPI settlement are not two checks on the same thing. They establish
different fits, at different times, with different evidence, and a feature can pass one and
fail the other.

| | **Verification** | **KPI settlement** |
| --- | --- | --- |
| Question | Does the feature behave as expected? | Did the change produce the value we claimed? |
| Establishes | **Problem–solution fit** | **Value fit** (in a true market: product–market fit) |
| Proof | Human judgment | Production telemetry |
| Environment | Non-prod | Production |
| Unit | Feature | The feature's KPI hypothesis |
| Timing | Before deploy — **blocking** | After the window closes — **non-blocking** |
| Failure means | Don't ship it | We shipped something that works and didn't matter |

That last cell is the reason the outer edge exists. Verification alone cannot catch a feature
that does exactly what it promised and changed nothing that mattered. Only telemetry can, and
only after the fact.

### Falsifiability is a gate on KPI authoring

A KPI is a hypothesis, and a hypothesis that cannot be falsified is an aspiration. At
feature-definition time, a KPI is admissible only if the BE can name all four:

1. **The metric** — the specific quantity that moves.
2. **The instrumentation** — what emits it, and whether that telemetry exists today or must
   ship with the feature.
3. **The window** — how long until the hypothesis is settleable.
4. **The falsifier** — the result that would count as *disproved*. If no observable outcome
   would falsify it, drop the KPI.

Point 2 has a build consequence: if the telemetry does not exist yet, emitting it is in
scope for the feature. A KPI whose instrumentation never shipped is unsettleable, and the
outer loop silently breaks.

This tightens the `neo-feature-authoring` skill, which today says only that KPIs are optional and
to "omit rather than invent one with no credible basis." Credible is now testable — see
`todo.md` § 14.

### Internal line-of-business portfolios

Many neo clients are not in a true market. They build and maintain internal LOB applications
and are increasingly applying a product mindset to the app portfolio. The second fit still
applies, but two adjustments are required.

**Name it value fit, not product–market fit.** There is no market to fit. The general
question — did this change deliver the operational value claimed — holds everywhere; PMF is
its special case where the users are also the buyers and can leave.

**Engagement metrics are inadmissible under captivity.** Internal users do not choose the
app and have no alternative to defect to. Adoption, DAU, session length, and feature usage
therefore measure *compulsion, not value* — a mandatory workflow reaches full adoption whether
it is excellent or miserable. In a captive population these are not weak evidence; they are
invalid evidence, and a KPI built on them will confirm itself no matter what shipped.

Admissible KPIs for internal LOB are **outcome** metrics — quantities that move only if the
feature actually helped:

- cycle time / time-to-complete a task
- error, rework, and exception rates
- cost per transaction
- support ticket or escalation volume
- manual touches eliminated per case

**Mind the counterfactual.** With no churn signal and no competitor, there is nothing to
compare against by default. A captive-population KPI needs a deliberate baseline — a
pre-change measurement, a holdout group, or a staged rollout — designed *at feature-definition
time*, because it usually cannot be reconstructed after the fact. The window should be chosen
to accommodate it.

---

## Integration modes

### Two rules, not one

`neo-task-authoring` previously stated a single "one task ≈ one PR" rule. That conflated two
separate decisions, and only the second is contextual:

- **Task sizing** — a task is one coherent, independently validatable, reviewable chunk of
  change. **Universal. Not optional.** It is what makes validation criteria expressible and
  review tractable. "One PR" remains the unit of *measure* here.
- **Integration target** — where that chunk merges, and what can be atomically reverted
  afterward. **Project-level choice.** Both modes below preserve one-task-one-PR; they differ
  only in what the PR targets.

### The deciding principle

**Revert granularity should match verification granularity.**

The BE verifies **features** — that is what gates ship. So the unit you can cleanly undo when
it misbehaves in production should also be the feature. Mode A aligns the two. Mode B
deliberately breaks the alignment and buys smaller batch size with it.

### Mode A — feature branch, squash to main `[default]`

**Flow.** Each task PRs into a long-lived branch for its parent feature, reviewed and
validated there. When the last child task lands, that branch *is* the verification target —
the BE runs the feature's verification steps against a non-prod deploy of it. On verification
pass, the branch squash-merges to the default branch: **one commit, one feature.**

**Properties.** Feature-level revert is a single commit. The feature can be seen whole in
non-prod with no additional machinery. Fan-in is solved structurally rather than tracked.

**Obligations.** The feature branch must be refreshed from the default branch regularly to
limit drift. Non-prod must be deployable from an arbitrary feature branch. The squash commit
body must carry child task IDs — see Traceability below.

**Costs.** Long-lived branches, integration risk deferred to merge time, merge pain that
grows with feature size.

That last cost is partly a feature. Mode A puts real back-pressure on feature sizing: a
feature too large to hold on a branch is almost certainly too large for the BE to verify as a
single judgment anyway. The pain shows up early, at decomposition, rather than late.

### Mode B — tasks to main behind flags

**Flow.** Each task PRs directly to the default branch, its behavior gated by a feature flag.
A completion tracker fires when every child task of a feature has merged. Verification runs in
non-prod with that feature's flag enabled.

**Entry conditions — all must hold.** Do not choose Mode B without:

1. Feature flag infrastructure already in production use.
2. A non-prod environment where flag state can be set per-feature, per-verification-run.
3. A tracker that knows which tasks belong to which feature and when all have landed.

**Properties.** Smallest batch size, continuous integration, no branch drift. Fast mitigation
in production — disable the flag.

**Costs.** Revert granularity no longer matches verification granularity: the flag toggle
hides the feature, but removing the code is N-commit archaeology. The default branch carries
dormant partial features. Flag cleanup after verification becomes standing debt, and
un-cleaned flags accumulate into a second, undocumented configuration surface.

### Choosing

| | **Mode A** (default) | **Mode B** |
| --- | --- | --- |
| Batch size | Feature | Task |
| Revert unit | Feature — one commit | Flag toggle; code removal is N commits |
| Verification target | The feature branch | Default branch + flag state |
| Requires flag infrastructure | No | **Yes** |
| Branch lifetime | Feature duration | Hours to days |
| Integration risk | Deferred to merge | Continuous |
| Fan-in mechanism | Structural | Tracker + flag state |
| Best fit | Most LOB work; teams without flag infrastructure | Trunk-based teams with mature flags |

Mode A is neo's default because it matches revert to verification for free, and because the
flag infrastructure Mode B requires is not present in many internal LOB shops. Choose Mode B
deliberately, with its entry conditions met — not by drift.

### Traceability under squash

Squashing collapses per-task commits on the default branch. The feature becomes one commit,
which is exactly what makes it revertable — but it removes task-level history from the graph.

For LOB and regulated clients, the commit → task → feature → requirement chain may be an
audit requirement. Preserve it in the **commit message body** rather than the graph: the
squash commit lists every child task ID and its parent feature ID. Decide this at project
setup; it cannot be reconstructed after the merge.

---

## Related open items

- Diagram 2's expanded sub-box is labeled "Specification Loop" but contains the Coding loop
  phases (Research → Planner → Implement → Testing → Review → PR). Drawing bug; fix before it
  propagates into docs.
- `Operations Space` is drawn outside all three loops in Diagram 2, with no boundary defined
  between Deployment and Operations. Treated above as an implicit fourth boundary.
- See [`todo.md`](../todo.md) for repo-level defects found alongside this mapping.
