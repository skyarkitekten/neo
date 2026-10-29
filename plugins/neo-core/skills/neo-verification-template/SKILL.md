---
name: neo-verification-template
description: Use when turning a signed-off spec, feature, or task into a verification plan — executable acceptance checks, layered evidence, a case matrix, and a tester record that prove what was built. Load when writing acceptance checks before generation, when acting as an independent verifier, or when deciding whether a change has enough evidence to merge.
---

# Verification template

A spec says what we want. It does not prove what we got. This skill produces the **verification plan** that closes that gap: a document that maps every requirement to an executable check and to recorded evidence.

The spec is an input. The evidence is the deliverable.

Worked example: `assets/example.md` (a full plan for one story). Copy its *structure*, not its repository-specific details.

## Principles

- **Checks before generation.** Acceptance criteria are written as executable checks before the builder runs. A criterion that cannot be checked is an under-specified requirement — fix the requirement first.
- **Independent verification.** The verifier is separate from the builder. It runs the checks itself. A builder's "tests pass" claim is not evidence; the command output and exit code are.
- **Layered evidence.** Match the check to the risk, not to habit (see the layer table).
- **Gates on evidence, not approval clicks.** A change merges when its cases are `Pass` with recorded evidence. Human review is for verification strategy and residual risk, not for re-reading code the checks already cover.
- **State what the evidence does not prove.** Every plan has an explicit limitations section. Mocks and controlled tests prove boundaries, not semantic quality or live behavior.
- **Spec drift is detectable.** Every plan pins the source revision (commit SHA, spec version). If the code or spec moves, the plan's results are stale until re-run.

## Evidence layers

Pick the layers that the risk justifies. Do not add a layer by default.

| Layer | Proves | Use when |
|---|---|---|
| Unit / property tests | Pure logic, invariants, boundary values, arithmetic | Always for logic; property tests for ranges, orderings, and rounding |
| Contract tests | Schema, serialization, cross-component compatibility | Any boundary between services, languages, or stored documents |
| Integration tests (real dependencies) | Persistence, auth, migrations, end-to-end API behavior | Data stores, tenancy, security-sensitive paths |
| Static analysis / types / lint | Absence of entire bug classes | Always; record exit codes |
| Policy-as-code | Configuration and infrastructure rules hold | Deployment, IAM, network, regulated settings |
| Runtime evals | Agent or model behavior on representative inputs, scored against an approved rubric | Any LLM-backed component; scoring must not be done by the generator itself |
| Formal methods | Safety or liveness properties of a small critical core | Only where failure cost justifies the cost — state machines, money, safety |
| Authorized manual / live procedure | Behavior in a real environment | Last; only when automated layers cannot reach the property |

Anything that needs a live environment that is not available is `Blocked`, not `Pass`.

## Workflow

1. **Pin the source.** Record the commit SHA, branch, and any local modifications before running anything. A plan without a SHA is not auditable.
2. **Trace requirements to checks.** For each acceptance criterion in the spec or task, write one or more cases. Every case has an ID and traces to one criterion. Every criterion has at least one case.
3. **Choose the layer per case.** Use the table above. Prefer the lowest layer that can prove the property.
4. **Write the expected result as an observable outcome.** Status codes, returned values, row states, exit codes, emitted documents. Not "works correctly" and not "looks right".
5. **Write the automated command blocks.** Each block is runnable as written, records its exit code immediately, and states the expected output. For filtered test runs, require a minimum selected-test count so an empty filter cannot pass silently.
6. **Write the manual/live section only if needed.** Mark prerequisites explicitly. If a prerequisite is absent, the case is `Blocked`, and the automated groups still run.
7. **Write the exit criteria and tester record.** Blank fields for the executor to fill in.
8. **Execute and record.** The verifier runs each block, records the exit code, and changes each case from `Not Run` to `Pass`, `Fail`, `Blocked`, or `Inconclusive` with the evidence.
9. **Decide the gate.** Merge only when every required case is `Pass`. Any `Fail` stops the gate. `Blocked` or `Inconclusive` cases must be listed as residual risk with an owner.

## Case result definitions

- **Not Run** — default. Never change to Pass without evidence.
- **Pass** — the command or procedure ran, its exit code and counts are recorded, and the observed result matches the expected result.
- **Fail** — ran, and the observed result differs from expected. Record actual output. Do not edit the expectation to match.
- **Blocked** — could not run because a prerequisite is absent (environment, approved policy, deployed component, credentials). Name the missing prerequisite.
- **Inconclusive** — ran, but the result cannot distinguish pass from fail (a skipped test, a partial log, a flaky run). Re-run or add a stronger check.

A skipped test is not a pass. A nonzero exit code is not cleared by a later successful command.

## Case matrix format

| ID | Procedure / Proof | Expected Result | Result |
|---|---|---|---|
| A01 | <command or procedure, with the criterion it proves> | <observable outcome> | Not Run |

Rules:

- IDs are stable across revisions. Retire a case by marking it removed, not by renumbering.
- Expected results name the exact status, value, state, or artifact. Include negative cases (invalid input, unauthorized caller, stale version, tampered data) alongside positive ones.
- Each criterion needs at least one negative or boundary case, not just the happy path.

## Automated command block format

````markdown
### <Letter>. <What this block proves>

```powershell
<exact command>
$LASTEXITCODE
```

Expected: <observable outcome, counts, no introduced warnings>.
````

- Run each block separately and record its exit code before the next.
- Do not substitute a different command when one fails. Investigate and record.
- Do not disable, skip, or weaken a check to obtain a green result. Do not replace a real dependency with a success-shaped stub in a live-proof case.
- Record log paths for any generated evidence.

## Verifier independence

- The verifier does not edit production code to make checks pass. A failing check goes back to the builder as a `Fail`.
- The verifier does not accept the builder's summary as evidence. It re-runs the commands or reads the artifacts directly.
- Where possible, the verifier's context is separate: it reads the spec and the plan, not the builder's reasoning.
- Reviewing generated output against the approved rubric is done by a reviewer who did not produce it. A generator never scores its own output.

## Verifying agent instructions, skills, and hooks

Agent configuration is code and gets the same treatment:

- **Tool selection:** a case asserts the agent calls the intended tool for a representative prompt, and does not call a forbidden one.
- **Alignment:** a case asserts the output follows the instruction's stated constraints on a prompt set that includes adversarial and out-of-scope inputs.
- **Hooks:** a case asserts the hook fires on the intended event and exits cleanly when its script is absent.
- Run these as runtime evals with recorded pass counts. A single successful run is `Inconclusive`, not `Pass`.

## Anti-patterns

- A plan written after the code, reverse-engineered to match what was built.
- Expected results that say "no errors" without naming the outcome.
- Counting skipped or filtered-to-zero tests as passes.
- Treating a mock-backed or controlled-response test as proof of live behavior, semantic quality, or deployment readiness.
- Asking a human to verify something a machine check can express.
- Letting the generator score its own output against the rubric.
- A green gate with unresolved `Blocked` cases and no named owner.

## Template

```markdown
# <Spec or task id> <Title> — Verification Plan

## Scope and status
- Every case starts Not Run.
- Source: <full SHA>, <branch>, <local modifications>.
- Spec revision: <id/version>.
- What this plan covers, and what it explicitly does not.

## Prerequisites and safety
- Required tools and versions.
- Isolated test resources; what must not be touched.
- Secrets handling: never record tokens or credentials.

## Automated checks
### A. <what this block proves>
<command block with $LASTEXITCODE and expected output>

## Case matrix
| ID | Procedure / Proof | Expected Result | Result |
|---|---|---|---|
| A01 | ... | ... | Not Run |

## Live procedure (only if a live proof is required)
- Prerequisite checklist. Missing prerequisite => Blocked.
- Steps with expected results.

## Exit criteria and tester record
| Record | Fill in |
|---|---|
| Tester / UTC timestamp | |
| Source SHA / branch / local modifications | |
| Environment and isolated identity (no secrets) | |
| Per case result, expected vs actual | |
| Automated evidence: command, exit code, selected/passed/failed/skipped, log path | |
| Blockers and residual risk, each with an owner | |

## References and limitations
- What the evidence does not prove.
- Stale documentation that conflicts with current behavior.
```

## Checklist before handing off a plan

- [ ] Source SHA and spec revision pinned.
- [ ] Every acceptance criterion traces to at least one case.
- [ ] Every case has an observable expected result and a stable ID.
- [ ] Negative and boundary cases exist for every criterion.
- [ ] Every automated block records its exit code and requires a minimum selected-test count.
- [ ] Live steps list prerequisites; absent prerequisites are marked `Blocked`.
- [ ] Limitations state what the evidence does not prove.
- [ ] No case is marked `Pass` without recorded evidence.
- [ ] Anyone gathering or citing evidence from this plan has loaded `neo-evidence-standard`.
