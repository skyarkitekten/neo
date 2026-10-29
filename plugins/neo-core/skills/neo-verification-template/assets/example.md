# Issue #1 Local Manual And Automated Test Plan

## Scope And Status

**Every case starts Not Run.** This is a fresh procedure for your checkout, not a claim that your local environment passed. It follows AB#67856 revision8 and the final scoped implementation at a198ecaca5b62c87f23786aef064e0314985ac72 on feature/67856-improve-preparation-instructions. The code is local and unpushed; another checkout cannot fetch it until a push occurs. Do not reset or switch a shared checkout just to match this plan.

This story tests the independent Instructions agent, approved rubric, registration/invocation through the SAME common capability workflow, and source-bound terminal handoff. It does not add comparison/edit/apply/history UI, proposal decisions, whole-version approval or publication. Those belong to AB#68171. No instructions UI walkthrough is available for this story; use automated tests and the authorized API procedure below.

The generator does not score itself. Shared downstream assessment uses the four approved criteria. Current Real composition has no genuine scorer binding; no deployed accepted Instructions version has been established. Controlled automated tests can pass now; a live, genuinely assessed completion remains Blocked until those dependencies exist.

## Prerequisites And Safety

- Use PowerShell from the repository root. Record the SHA and local modifications first. Required existing tools: .NET10 SDK, uv, PowerShell, and Podman for PostgreSQL integration tests.
- Use an isolated fixture-owned test database. Follow repository testing setup for Podman/Testcontainers. Do not roll migrations back against the application database, delete volumes, or stop shared services.
- Do not deploy or publish to CBORD for this plan. No live Foundry operation is required for the offline test groups.
- For manual API cases, use an authorized nonproduction environment, actual Admin/RecipeEditor accounts, actual API URL and disposable recipe. Use existing authenticated tooling; never record tokens or authorization headers.
- The first recipe-changing enrichment opens a working Draft before capture; subsequent runs reuse the open working Draft. Receiving a proposal never applies its instruction text. Do not incorrectly require version-count invariance across initial admission.
- Do not start a second AppHost blindly. If startup is needed, follow the checkout's existing developer guide and identify resources owned by your checkout. This procedure does not require stopping or replacing an already-running application.
- Dependencies are locked. Restore only after a chosen command reports missing packages, or follow the explicit fresh-checkout sync below. Never fix a test by disabling auth, substituting demo confidence, hardcoding aggregate weights or replacing an unavailable real service with a successful-looking result.

```powershell
git rev-parse HEAD
git status --short
git branch --show-current
```

## Automated Checks You Can Run Locally

Run each block separately and record its exit code immediately. Stop and investigate a nonzero exit; a later successful command does not erase it. Filtered .NET commands use Microsoft Testing Platform and require at least one selected test; check that each intended class appears. Counts below are reference results at the implementation baseline, not fixed pass-rate requirements or your execution record.

### A. Solution Build

```powershell
dotnet build src\RecipeOptimization.slnx
$LASTEXITCODE
```

Expected: zero errors and no introduced warnings. Last recorded complete build reported zero warnings/errors.

### B. Full Cross-Language Worker Regression Harness

```powershell
& .\tests\fixtures\enrichment\v1\run-goldens.ps1
$LASTEXITCODE
```

Expected: .NET exports actual request/output documents; Python validates them and exports reverse documents; the final .NET pass validates Python output. Worker pytest, ruff, formatting and mypy all pass. Reference final result:338 .NET export cases,1618 Python cases,111 .NET reverse cases, no failures or xfail. Logs and actual documents are written under tests\unit\bin\enrichment-golden-exchange\{generated-id}; the harness prints the precise path.

For a fresh checkout, or if this command reports missing generator/SDK dependencies, use the worker's locked optional dependencies, then rerun the harness:

```powershell
Push-Location src\workers\recipe-optimization
try {
    uv sync --locked --extra generator
} finally { Pop-Location }
```

Do NOT substitute bare pytest for this full harness. Three actual-.NET exchange tests require ENRICHMENT_GOLDEN_EXCHANGE, which the script sets and restores. Standalone pytest failures saying to run the .NET golden exporter are incomplete setup, not a successful run. Do not suppress or skip these tests to obtain a green result.

### C. Instructions Agent Package

```powershell
Push-Location src\agents\recipe-instructions-generator
try {
    uv run --locked pytest tests -q
    # Record exit code before running the next check.
    uv run --locked ruff check src tests deployment
    uv run --locked ruff format --check src tests
    uv run --locked mypy src tests
} finally { Pop-Location }
```

If uv reports missing locked dependencies, run uv sync --locked in this same package and retry. Expected:303 tests pass; lint and source/test type checks pass. Deployment-only mypy was previously reported to have three advisory errors outside this source/test target; this plan does not claim deployment readiness. If the extra format check reports formatting differences, record them rather than reformat unrelated files during testing.

These tests use controlled/offline SDK responses. They prove input/output boundaries, strict options, timeouts/cancellation/cleanup, host/configuration and packaging checks; they do not prove semantic model quality, real identity/RBAC, live inference or Foundry bundle acceptance.

### D. Rubric, Adapter, Aggregation And Handoff Unit Tests

```powershell
dotnet test --project tests\unit\RecipeOptimization.UnitTests.csproj -- `
    --filter-class '*InstructionAssessmentRubricTests' `
    --filter-class '*InstructionAssessmentAdapterTests' `
    --filter-class '*InstructionAssessmentAggregatorTests' `
    --filter-class '*EnrichmentInstructionWorkflowTests' `
    --filter-class '*EnrichmentInstructionsHandoffBuilderTests' `
    --minimum-expected-tests 1
$LASTEXITCODE
```

Check all five class names were actually selected. Reference rubric67 cases; handoff builder65 cases. Expected: decimal anchors1/0.5/0, four criteria25%each, independent mixed arithmetic (for example1,0.5,1,0 ->0.625), explicit invalid findings, and no numeric overall/renormalization when any criterion is unavailable. A perfect score still carries NeedsReview, not automatic approval authority. The builder validates Python-generated ASCII/Unicode/source-gap handoff fixtures, source identity, exact order, digest mismatches and failure-state invariants.

For the full unit regression suite if desired:

```powershell
dotnet test --project tests\unit\RecipeOptimization.UnitTests.csproj -- --minimum-expected-tests 1
```

Reference full run:3495 total,3494 passed,1 previously reported skipped. Inspect and record the actual skipped test/reason; do not treat a skip as proof.

### E. API And Real PostgreSQL Integration

```powershell
dotnet test --project tests\integration\RecipeOptimization.IntegrationTests.csproj -- `
    --filter-class '*EnrichmentInstructionsHandoffApiTests' `
    --minimum-expected-tests 1
$LASTEXITCODE

dotnet test --project tests\integration\RecipeOptimization.IntegrationTests.csproj -- `
    --filter-class '*EnrichmentScoringPolicyRegistrySelectionApiTests' `
    --filter-class '*EnrichmentRunCommonReleaseSubmissionTests' `
    --minimum-expected-tests 1
$LASTEXITCODE
```

Reference new handoff API35 cases, selected-registry Admin18 and common submission3. The tests use the repository's SharedPostgresFixture through Podman. They exercise real API/PostgreSQL/capture/validation/finalization, but author controlled completion documents: no live Foundry/scorer or Durable Task execution occurs in these tests.

For broader affected runtime regression:

```powershell
dotnet test --project tests\integration\RecipeOptimization.IntegrationTests.csproj -- `
    --filter-namespace 'RecipeOptimization.IntegrationTests.Recipes.Enrichment' `
    --minimum-expected-tests 1
```

Reference broader runtime348 cases. Do not combine namespace and class filters expecting a union; the runner may AND them. Keep the blocks separate.

## Case Matrix

| ID | Procedure / Proof | Expected Result | Result |
|---|---|---|---|
| A01 | Run the build and golden harness above. | No introduced build failures; both serialization directions and worker checks green; Description compatibility retained. | Not Run |
| A02 | Run package boundary cases: empty input, malformed JSON, duplicate IDs, bool/float ordinals, omitted/reordered/added output steps, unknown annotation references and extra confidence fields. | Safe explicit validation/InsufficientInput; no invented replacement, no partial output or self-score. Cooking text such as score dough is accepted. | Not Run |
| A03 | Run agent host/configuration/stream cases. | Strict schema/store=false; caller tools/options stripped; complete output validated before emission; timeouts/cancellation clean resources; no fallback. | Not Run |
| A04 | Inspect common workflow binding cases in the golden harness. | Description and Instructions consume the same original snapshot independently; fan-in precedes exactly one shared assessment call; wrong agent/version/profile rejected. | Not Run |
| A05 | Run rubric/assessment unit cases. | All-high=1, all-low=0, mixed=0.625; exact four criteria/rationale/references; unavailable means null overall, not zero or partial reweight. | Not Run |
| A06 | Run handoff API success/unavailable/failure cases. | Separate captured original/proposed/annotations, versions/provenance/digests/attempts; Ready proposal may coexist with Unavailable assessment and Incomplete run. | Not Run |
| A07 | Run same-working-Draft edit and superseding-version cases. | isSourceCurrent=false when version or actual content digest differs; captured source text remains unchanged. | Not Run |
| A08 | Run tampered-source/unknown references/status mismatch cases. | StoredDataInvalid or explicit invalid assessment, never trusted Ready/confidence from corrupt data. | Not Run |
| A09 | Run auth/tenant/replay cases. | 401/403/404 as applicable; no cross-tenant content; repeated completion/replay does not duplicate or overwrite history. | Not Run |
| A10 | Check pending/failed parent cases. | No independently delivered preterminal proposal; explicit Pending/RunFailed/failure details without older-success substitution. | Not Run |

## Authorized Manual API Walkthrough

These are optional local/nonproduction checks, NOT a promise that the current machine is configured for live execution. If a prerequisite is absent, mark Blocked and run the automated groups instead. No new Instructions comparison/apply UI exists in this scope.

### Runtime Prerequisite Checklist

- API selects Enrichment:Runtime:CurrentRegistryId=common-release and CurrentRegistryVersion=1.0.0, with a matching release entry and exact per-capability ProviderAgents map. Description pin must match GeneratorAgent settings; Instructions pin must be the actual accepted deployed agent/version.
- Worker selects ENRICHMENT_RELEASE_ID=common-release and ENRICHMENT_RELEASE_VERSION=1.0.0, plus approved Foundry/DTS settings and FOUNDRY_INSTRUCTIONS_AGENT_NAME=recipe-instructions-generator and the actual FOUNDRY_INSTRUCTIONS_AGENT_VERSION. Do not use latest, a made-up version or the Description agent name.
- A valid selected-registry admin policy exists with explicitly approved weights for Description AND Instructions. The four25%criterion weights are not aggregate weights. Do not create or overwrite policy without the environment owner's approval.
- Real shared scorer service/binding is required for a genuine numeric assessed completion. The implementation currently has no production real scorer binding. Do not invent SCORER_* settings or enable the Description-only Simulated scenario for common-release; that combination is rejected.
- All endpoint/model/profile/credential/tenant/actor settings come from the environment owner. No secrets belong in the tester record.

### API Steps

Use the actual API base URL in your authenticated API client. UUID placeholders below must be replaced with real nonzero IDs. The client request key is new for a new test; retain it verbatim for a replay test.

| ID | Action | Expected Result | Result |
|---|---|---|---|
| M01 | Record disposable recipe/version ID, current instructions/status, current selected release/policy and actual tested SHA. | Identifiable source baseline; common-release registration known rather than assumed. | Not Run |
| M02 | As Admin GET /api/admin/enrichment-scoring-policy with query parameters registryId=common-release and registryVersion=1.0.0. | 200 with actual registry/rubrics. Unconfigured policy reports configured=false/valid=false; it is not silently defaulted. In that case stop live submission and mark Blocked until owner configures it. | Not Run |
| M03 | POST /api/recipes/{recipeId}/enrichment-runs using body below. | 201 new run, Location/runId/frozen binding and cycle receipt; initial working Draft may be created. It is not evidence of completed generation/scoring. | Not Run |
| M04 | Repeat the exact same request key/body. | 200 replay with same run identity; changed payload using the same key returns409 RequestKeyConflict. | Not Run |
| M05 | Follow GET /api/enrichment-runs/{runId} until a terminal outcome. | Existing parent progress/states; no independent early Instructions delivery. If live agents/scorer are unavailable, record explicit error and Blocked genuine-success case, not Pass. | Not Run |
| M06 | For an actually generated successful capability inspect instructions. | capabilityId recipe-instructions, source version/content/evidence digests, ordered original/proposed steps, separate annotations, actual served agent/version and attempts; requiresHumanApproval=true, projection=NotProjected, no canApply. | Not Run |
| M07 | Inspect assessment and overall lifecycle independently. | Genuine score only with actual assessment provenance; four typed criteria. Missing real scoring is Unavailable/NotAssessed with null confidence and honest Incomplete status, not fake certainty or a complete recipe. | Not Run |
| M08 | Re-read after an ordinary edit to the same disposable working Draft, if permitted by existing workflow. | Handoff retains original captured text; isSourceCurrent=false when content changed even if version ID stayed the same. No Apply/approval action is tested here. | Not Run |
| M09 | Call GET without authentication, then as a user lacking Admin/RecipeEditor; use another-tenant/unknown run only in approved fixtures. | 401,403 or404 as applicable; no instruction content leakage. | Not Run |
| M10 | Reopen/read the run and inspect recipe instructions. | Terminal captured output remains readable and attributable; generated text was never automatically applied, approved or published. Shared admission Draft creation is not mistaken for applying instructions. | Not Run |

Submit body (the first two members are required; other members are existing optional guards):

```json
{
  "clientRequestKey": "REPLACE-WITH-NEW-NONZERO-UUID",
  "sourceRecipeVersionId": null,
  "acknowledgePublishHistory": false,
  "expectedETag": null
}
```

A successful-publication-history recipe may return428 requiring reviewed acknowledgment; do not automatically set true. Stale ETag is412; obsolete source/invalid Draft state may be409. Do not bypass these safeguards. There is no failure-simulation endpoint, capability picker, per-request policy/mode override or new instruction apply endpoint.

## Exit Criteria And Tester Record

Automated and live status are separate. Passing controlled tests is not proof of real Foundry inference, culinary fidelity, deployed packaging, actual cloud auth or a live scorer. Review genuine model output against actual source and approved rubric; unit mocks do not certify safety. Supplied component gaps must stay explicit; absent recursive capture cannot establish exhaustive cycle/child assessment.

| Record | Fill In |
|---|---|
| Tester / execution time | Name; UTC timestamp |
| Source | Full SHA; branch; local modifications; code location (changes are currently unpushed) |
| Environment | Actual API endpoint; isolated DB/runtime identity; no secrets |
| Test identity | Recipe/source/working version IDs, run ID, client request key and correlation ID |
| Per case | Not Run / Pass / Fail / Blocked / Inconclusive; expected versus actual |
| Automated evidence | Command, exit code, selected/passed/failed/skipped counts and log path |
| Runtime evidence | Sanitized request/response, input/output digests, served agent/version, rubric/policy versions, assessment provenance |
| Blockers | Missing deployed Instructions version, real shared scorer, authorized environment or approved aggregate policy; do not label as passed |
| Cleanup | Close own clients; stop only resources explicitly started/owned; do not delete shared recipes or volumes |

## References And Limitations

- AB#67856 revision8; follow-up AB#68171 (comparison/apply/history/review/publication).
- Reference format: AB#67854 implementation comment16491609/archival16510881, manual16491790, local automated/manual16510880, read for this request.
- Repo docs: docs\API\enrichment-runs-api.md; docs\developers\reference\enrichment-scoring-policy-api.md; src\contracts\enrichment\release-v1\README.md; worker README and agent README.
- Some older README paragraphs still describe the pre-C3/pre-binding stage. Current code/API docs and selected-registry tests show common-release/rubric registration exists; this does NOT mean the real scorer or deployment exists. Treat contradictory old unregistered/Description-only catalog prose as stale documentation, not permission to change runtime defaults.
- No SQL mutation/report is required for this test plan. The real-Postgres automated suite supplies database evidence without asking you to alter stored run documents.