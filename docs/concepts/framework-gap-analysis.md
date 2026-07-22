# Framework Gap Analysis — the OODA / PDCA / Double-Diamond baseline

Why this document exists: neo's design record describes *what neo is* and *how work crosses
its loops*. This document steps outside neo and asks a different question — **measured against
a general theory of iterative problem-solving, where does neo already hold, where is it ahead,
and where does it still leak?** It memorializes an extended design dialog that baselined neo
against a process framework built on OODA, PDCA, and the Double Diamond, so the conclusions are
findable rather than lost in chat history.

Terms in **bold** are defined in the [glossary](../glossary.md). The loops are described in
[architecture.md](./architecture.md); the loop *boundaries*, the **two fits**, and the
captive-population rule are owned by [process-flow.md](./process-flow.md) — this document links
to them rather than restating them.

**Scope.** This is a *concept* doc — the *why*, and a snapshot of a moving target. It is not a
contract. The gaps it names (G1–G5) are reconciled against the live GitHub backlog in the table
below; the backlog, not this file, is the source of truth for what is being worked. The baseline
was taken at commit `efd6a8f` (latest `main`, includes PR #44 `preToolUse` enforcement).

---

## The framework (the yardstick)

The dialog modelled the SDLC as four interlocking loops — **Problem → Solution →
Implementation → Operation** — with feedback edges running backward, and distilled nine
principles. They are the measuring stick the rest of this doc applies to neo.

1. **Leaks live in soft handoffs.** The failure mode of the whole system is always a weak
   coupling artifact at a *boundary*, never a bad *box*. Every boundary needs a named coupling
   artifact and a convergence / exit criterion.
2. **The worst leak (~50%) is Problem → Solution — and it is upstream of any handoff.** It is
   **problem identification** (is this the *binding constraint*, not the loudest symptom?) and
   **hypothesis construction** (is the causal story testable, with a kill condition?). Every
   generative framework treats this region as a *given input* and so offers no help with it.
3. **A rejection gate is the one thing missing from generative frameworks.** Design Thinking,
   Systems Thinking, and a Product Mindset are all *generators* — they widen the funnel. The
   deficit is *selection*, not generation. Something must be able to say **"no"**: a hard,
   binary, cost-blind gate on *testability* (is there a falsifiable hypothesis with a locked
   kill condition?).
4. **Two sequential, asymmetric gates.** First (a) *hypothesis quality* — a hard binary reject,
   decided **cost-blind**. Then (b) *test cost* — soft human judgment, and it must come **after**
   the kill condition is locked, or people soften hypotheses to look cheap to test
   ("falsification laundering").
5. **Feasibility is empirical-only.** It emerges by building, not by up-front assessment. So it
   does not *select* problems, it *prices* them ("cheap vs expensive to falsify"). Front-loaded
   feasibility gates are theater.
6. **Pre-registered kill condition.** Written *before* the build. The final step must be
   adversarial — **"Falsify"** (try to kill it), not confirmatory ("Verify", does it work?).
   The bias lives in movable goalposts, so pre-registration is the real fix.
7. **The gate is team-held with single-member veto** on testability — easy to fail, hard to
   pass. Not consensus (which softens), and not a lone reviewer (a single point of failure).
8. **Two framing phases, two time constants.** *Strategic* framing (once per epoch; defines the
   system; existential, slow-to-falsify kill conditions; near-irreversible) vs *tactical*
   framing (continuous; within the committed system; cheap, fast kill conditions; reversible).
   They share a *pattern* but not a *threshold*. **Open question the dialog never closed: what
   signal earns a strategic reopen?**
9. **Operation → Problem is the load-bearing feedback edge** — the learning loop, not just
   hotfix/patch. Closing it is the value-add; but a fast Operation → Problem feeding a *leaky*
   Problem → Solution compounds the leak.

---

## Where neo already holds

Against principle 1 ("leaks live in soft handoffs"), neo is sharper than the dialog was: it
already names the coupling artifact and exit criterion at every seam. See the boundary table in
[process-flow.md](./process-flow.md#the-chain) — artifact / gate / owner / on-reject for each of
the three loop boundaries. Specifically:

- **Boundary 1 is a hard human gate.** The **BE** owns Specification → Coding, because "a bad
  split poisons everything downstream, so no agent may open it alone" — principle 1 made
  concrete. See [process-flow.md § Boundary 1](./process-flow.md#boundary-1--specification--coding).
- **The four-field kill condition already exists** — for KPIs. *Metric / instrumentation /
  window / falsifier* is nearly verbatim principle 3's testability gate. See
  [process-flow.md § Falsifiability is a gate on KPI authoring](./process-flow.md#falsifiability-is-a-gate-on-kpi-authoring).
- **verify / validate is split by unit** — humans verify **features**, machines validate
  **tasks**. See [architecture.md § The core rule](./architecture.md#the-core-rule).

## Where neo is *ahead* of the framework (do not regress)

- **The two fits.** Verification (**problem–solution fit**; human; non-prod; blocking) is a
  distinct check from KPI settlement (**value fit**; telemetry; prod; non-blocking). This is
  more correct than collapsing both into one "Falsify" step, because a feature can pass one and
  fail the other. Owned by [process-flow.md § The two fits](./process-flow.md#the-two-fits).
- **The captive-population rule.** For internal LOB, engagement metrics (DAU, adoption, session
  length) are *inadmissible* — under captivity they measure compulsion, not value; only outcome
  metrics (cycle time, error/rework rate, cost per transaction, tickets, manual touches
  eliminated) are admissible, and they need a deliberate baseline/holdout designed at
  feature-definition time. Owned by
  [process-flow.md § Internal line-of-business portfolios](./process-flow.md#internal-line-of-business-portfolios).
- **The verify/validate cut** is cleaner than the dialog's single gate, per the same reasoning.

These are neo's contributions *back* to the framework. Any future work on G1–G5 must preserve
them.

---

## The gaps (G1–G5) and their backlog reconciliation

Each gap is a place the dialog is ahead of neo. Coverage is reconciled against the open GitHub
backlog (`gh issue list --state open`) and the untracked loose ends in
[`todo.md`](../../todo.md).

| Gap | Where it bites | Tracked by | Coverage | What's missing |
| --- | --- | --- | --- | --- |
| **G1** — problem identification / **binding constraint** | PRD → Feature | none (#41/#39 are spec *intake*, not framing) | **Untracked** | No "is this the *binding constraint*?" test. The home is live (`feature-agent`), but its gate is only "segment has a business justification." |
| **G2** — kill-condition gate at **build entry** | Boundary 1 | `todo.md` loose end only (back-door / KPI slice) | **Partial** | The loose end folds the *existing* KPI gate into the skill. The stronger move — a testability gate at the **front door** — is untracked, and is a genuine open design question. |
| **G3** — **falsification-framed** verification | Boundary 3 | none (#14 is SRE/Platform-Eng ops agents) | **Untracked** | The default question is confirmatory ("does the feature behave as expected?"). Mitigated by the mis-built / mis-specified / both triage, but the word and the default still ask "does it work." |
| **G4** — **strategic vs tactical** framing | whole spec loop | none | **Untracked** | neo has one framing cadence (PRD → Feature → Task). No concept of a signal big enough to reopen the *system* vs spawn a *feature*. Includes the unresolved "what earns a strategic reopen?" |
| **G5** — single-human vs **team-with-veto** entry gate | Boundary 1 | none | **Untracked (likely by-design)** | The entry gate is a single human (BE). Robust against committee-softening, but is the single point of failure principle 7 flags. |

### Notes on each

**G1 — no named home for the binding constraint.** PRD → Feature *is* in the boundary table
(the `—` row), with gate "Segment has a business justification," `[live]`. So this is a
*weak-gate* problem, not a missing box: a "business justification" is not a binding-constraint
test. The `feature-agent` and `neo-feature-authoring` skill are **live** (per
[architecture.md § Status](./architecture.md#status)) — note that [glossary.md](../glossary.md)
still marks "Feature Skill / Feature Agent `[target]`", a stale inconsistency worth fixing. This
is the ~50% leak region from principle 2, and it currently has no discipline attached to it.

**G2 — the kill condition guards the back door, not the front.** neo's four-field falsifier
lives on **KPI authoring** (value fit, settled in production after the fact). A feature can
*enter* the build with a fuzzy "why" as long as the BE signs it. The dialog (principles 3–6) put
kill-condition discipline at the **front door**, before build. Two caveats keep this honest:
(1) the `todo.md` loose end already covers memorializing the *existing* KPI gate into the skill —
that is real but is not this; (2) whether Boundary 1 *should* also carry a testability gate is an
**open question**, not a settled defect. neo's back-door-only placement may be the right call;
this doc flags it for a decision, it does not presume one.

**G3 — verification is confirmation-framed.** Boundary 3 asks "does the feature behave as
expected?" Principle 6 says the terminal check should be adversarial. neo mitigates strongly with
the mis-built / mis-specified / both triage
([process-flow.md § Boundary 3](./process-flow.md#boundary-3--verification--deployment)), which
forces a diagnosis rather than a reflexive "write more code." But the default question and the
word "verify" still lean confirmatory.

**G4 — one framing cadence, one time constant.** neo has no concept of *strategic* framing
(defines the system, near-irreversible) distinct from *tactical* framing (within the system,
reversible). Every reopen is a feature-sized reopen. The dialog's unclosed question travels with
this gap: **what signal earns a strategic reopen?**

**G5 — single-BE gate.** Principle 7 wants a team-held gate with single-member veto. neo
deliberately uses a single human (the BE), which is the same design that removes the hand-off BA
(see [glossary.md § Roles](../glossary.md#roles)). This tension is likely **by design**, not a
defect — recorded here as an open question rather than a gap to close.

---

## Open questions

Carried forward from the dialog; none are settled:

1. **What signal earns a *strategic* reopen** (system-level) vs a *tactical* one
   (feature-level)? (G4, principle 8.)
2. **Is neo's back-door-only kill condition the right placement**, or should Boundary 1 also
   carry a front-door testability gate? (G2, principles 3–6.)
3. **Is the single-BE entry gate correct**, or does testability warrant a team-held gate with
   single-member veto — and can that coexist with the no-hand-off-BA principle? (G5, principle 7.)

---

## Related

- [process-flow.md](./process-flow.md) — owns the boundaries, the two fits, the KPI falsifiability
  gate, and the captive-population rule this analysis measures against.
- [architecture.md](./architecture.md) — owns the loops and the verify/validate core rule.
- [`todo.md`](../../todo.md) — the untracked loose ends, including the feature-authoring
  falsifiability fold that partially covers G2.
