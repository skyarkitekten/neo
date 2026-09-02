# Neo enforcement hooks

Two AGENTS.md guardrails must hold at the **harness** level, not merely in a prompt —
prompt rules are advisory and real enforcement lives outside the model:

1. **Never commit or push to `main`** (or `master`).
2. **Draft-PR-only** — agents open draft pull requests; they never open a non-draft PR
   and never mark one ready for review.

These are enforced by a blocking `preToolUse` hook. This is separate from — and has the
opposite reliability contract to — the fail-open observability logging in
[observability.md](observability.md).

> The manifest shape and script contract these hooks share (schema, the per-shell
> `${PLUGIN_ROOT}` rule, stdin/`{"continue":true}`) live in
> [`../reference/hook-contract.md`](../reference/hook-contract.md).

## Files

- `hooks/scripts/enforce-guardrails.sh` — the enforcement hook for Unix (macOS/Linux).
  Decisive (fail-closed) for the operations it recognizes.
- `hooks/scripts/enforce-guardrails.ps1` — the Windows/PowerShell sibling, byte-for-byte
  equivalent in behavior. The `bash` and `powershell` fields on the same hook entry let the
  CLI pick the right one per platform, so enforcement runs on Windows too (not just Unix).
- `hooks/hooks.json` — wires both scripts to the `preToolUse` event (same file that
  wires the observability logger).

## Copilot `preToolUse` command-hook contract

Verified against GitHub's [Copilot hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference).

- **Input** (stdin JSON, camelCase `preToolUse`): `{ sessionId, timestamp, cwd, toolName, toolArgs }`.
  The PascalCase `PreToolUse` variant uses `tool_name` / `tool_input`; the hook reads both.
- **Output** (stdout JSON) drives the decision:
  - `{"permissionDecision":"deny","permissionDecisionReason":"…"}` blocks the tool. The
    reason is **required** on deny and is shown to the agent.
  - Empty stdout (or `{"permissionDecision":"allow"}`) lets the tool run.
- **Exit code / failure semantics — decided deliberately (this hook is blocking, so it is
  NOT globally fail-open like the logger):**
  - Command `preToolUse` hooks are **fail-closed on error**: any crash or **non-zero exit,
    including exit `2`**, denies the call — even if stdout says `allow`. The hook therefore
    always `exit 0` and expresses its verdict purely through the JSON.
  - Command hook **timeouts always fail open** (the tool proceeds). This is unavoidable, so
    the hook is kept fast and dependency-light and `timeoutSec` is `10`.

> **Version caveat.** Command-hook denial has not worked in every Copilot CLI build (see
> [github/copilot-cli#3874](https://github.com/github/copilot-cli/issues/3874)). Confirm the
> deny path actually blocks in your installed CLI version; until then, treat server-side
> branch protection as the authoritative backstop.

## What the hook enforces

It inspects the shell tool (`bash`/`powershell`) plus the two desktop-app **host tools** that
can open or un-draft a pull request; every other tool (`view`, `edit`, `grep`, …) is allowed
immediately so enforcement never impedes normal work. The Unix hook
parses the payload with `python3` (already a repo dependency) rather than `jq`, so a missing
`jq` cannot brick every command; the PowerShell hook uses native `ConvertFrom-Json`.

**Rule A — block commit/push to `main`/`master`:**
- `git push` with an explicit refspec to `main`/`master` from any branch
  (`git push origin main`, `… HEAD:main`, `… :master`).
- `git commit` or a bare `git push` while HEAD is on `main`/`master` (resolved against the
  payload's `cwd`).

**Rule B — draft-PR-only:**
- `gh pr create` without `--draft`/`-d`.
- `gh pr ready` (which un-drafts a PR).
- The host tool `create_pull_request` called without `draft: true`.
- The host tool `update_pull_request` called with `draft: false`.

The last two matter because host tools carry **structured arguments, not a shell command
string** — they would sail straight past the command patterns. An agent granted
`create_pull_request` could otherwise open a non-draft PR with the guardrail none the wiser,
which is why Neo's own agents are granted the session host tools but deliberately *not* the PR
ones (see `docs/contributing/guides/agent-authoring-reference.md` § Host tools).

**Failure matrix:**

| Situation | Decision |
| --- | --- |
| Recognized blocked operation | **deny** (with reason) |
| Recognized safe operation | allow |
| Non-shell tool | allow |
| Payload unparseable (or `python3` absent on Unix) | allow + stderr warning |
| Hook times out | allow (harness fail-open) |

The unparseable case is a **deliberate** fail-open: denying every tool call on a parser
glitch would brick the session, and branch protection is the real backstop.

## Relaxing enforcement

Interaction with the per-session enablement levers from the observability set (#4):

- **Neo escape hatch:** set `NEO_ENFORCE_GUARDRAILS=0` (also `off`/`false`/`no`) to make the
  hook allow everything. Use it for legitimate exceptions (e.g. a maintenance task that must
  touch `main`).
- **`disableAllHooks`** — turns off all repo/user/plugin hooks for the session (policy hooks
  excepted). Broader than the escape hatch: it also disables observability logging.
- **`.github/copilot/settings.local.json`** — a typically-gitignored, user-specific settings
  file; use it to override or omit the enforcement hook locally without touching the shipped
  config.
- **`--config-dir`** — point the CLI at an alternate config directory that doesn't include
  the enforcement hook.
- **Prompt mode** (`copilot -p "…"`): repo hooks are disabled by default for security; opt in
  with `GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS=true`. Enforcement only runs in prompt mode when
  that variable is set.

Prefer the `NEO_ENFORCE_GUARDRAILS` escape hatch for a one-off exception — it is the narrowest
lever and leaves observability logging intact.

## Verify

Pipe a sample payload through the hook and check the decision:

```bash
printf '{"toolName":"bash","toolArgs":{"command":"git push origin main"}}' \
  | hooks/scripts/enforce-guardrails.sh preToolUse
# => {"permissionDecision":"deny","permissionDecisionReason":"Neo guardrail: pushing to 'main'…"}

printf '{"toolName":"bash","toolArgs":{"command":"gh pr create --draft"}}' \
  | hooks/scripts/enforce-guardrails.sh preToolUse
# => (empty stdout == allow)

printf '{"toolName":"create_pull_request","toolArgs":{"title":"x"}}' \
  | hooks/scripts/enforce-guardrails.sh preToolUse
# => {"permissionDecision":"deny","permissionDecisionReason":"Neo guardrail: agents open DRAFT…"}
```
