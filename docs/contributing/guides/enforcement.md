# Neo enforcement hooks

Two AGENTS.md guardrails are candidates for enforcement at the **harness** level rather than
in a prompt:

1. **Never commit or push to `main`** (or `master`).
2. **Draft-PR-only** — agents open draft pull requests; they never open a non-draft PR
   and never mark one ready for review.

Neo ships the scripts that enforce them, but **does not register them**. They are opt-in.
This is the opposite reliability contract to the fail-open observability logging in
[observability.md](observability.md), which *is* shipped registered.

> The manifest shape and script contract these hooks share (schema, the per-shell
> `${PLUGIN_ROOT}` rule, stdin/`{"continue":true}`) live in
> [`../reference/hook-contract.md`](../reference/hook-contract.md).

## Why they are opt-in

Neo registered `enforce-guardrails` on `preToolUse` through v2.1.0 and withdrew it. Three
reasons, in increasing order of weight:

**It is the consuming team's policy, not a plugin's.** Whether pushes to `main` are blocked,
and whether an agent may open a non-draft PR, is a call for the repo that installs Neo.
A plugin that imposes it on every consumer is overreaching.

**It cannot actually enforce what it claims.** It regex-matches command text. A push via a
configured `push.default`, an aliased remote, a `git -c` variant, or any tool path other than
the ones it enumerates is not matched. It is a speed bump for a cooperating agent, not a
control against a determined or merely unlucky one. The real control is **server-side branch
protection / rulesets**, which is authoritative, unbypassable, and already the team's to
configure.

**Its failure mode is catastrophic and unrelated to its job.** `preToolUse` fires before
*every* tool call, and it is fail-closed. The script allows non-shell tools immediately — but
only if it runs at all. Any failure to launch denies `view`, `edit`, and `powershell` just as
readily as `git push`, and `NEO_ENFORCE_GUARDRAILS=0` cannot rescue it because the script that
reads that variable is the thing that never ran. This has now shipped three times:

- A release moved hook scripts and long-lived sessions kept the previous manifest in memory,
  so the wired path no longer resolved (PR #93).
- The manifest invoked the script as `& $s`, which runs a script **file** and is therefore
  subject to PowerShell execution policy. On a stock Windows client, where every scope is
  `Undefined` and the effective policy is `Restricted`, the file simply refused to load
  (issue #95).
- The same manifest invoked `"$s"` on POSIX, which execs the file and therefore needs the
  executable bit. `[ -f "$s" ]` checks existence, not `-x`, so a copy that lost its mode bit in
  transit passed the guard and then failed exec with 126. macOS users hit the identical blanket
  denial (issue #95).

All three produced a non-zero exit, and a non-zero exit on `preToolUse` denies the call. Users saw
`Denied by preToolUse hook from "neo-core@neo" (hook errored)` on every action.

Spending that failure mode on weak, redundant enforcement of someone else's policy is a bad
trade. So the scripts stay in-tree, unregistered, and a team that wants the behavior opts in
below — with a wrapper that turns those infrastructure failures into allow-with-warning
instead of a blanket denial. `scripts/validate-plugins.py` fails the build if a shipped plugin
registers `preToolUse` again.

## Files

- `hooks/scripts/enforce-guardrails.sh` — the Unix (macOS/Linux) hook.
- `hooks/scripts/enforce-guardrails.ps1` — the Windows/PowerShell sibling.
- `hooks/hooks.json` — wires **only** the observability logger. It does not reference the
  guardrail scripts.

Both siblings enforce the same two rules, including against the desktop app's
`create_pull_request` / `update_pull_request` **host tools**, which carry structured arguments
rather than a shell command string and would otherwise sail past the command patterns entirely.

> **Duplicated, so it can drift.** A plugin cannot reference files outside its own directory, so
> each of `neo-core` and `neo-product` ships its own copy of all four scripts. That is four files
> to keep in step, and they have drifted before: `neo-product`'s pair sat a revision behind and
> silently missed the host-tool half of Rule B. If you change one, change all four and diff them.

## Opting in

Guardrail scripts live inside the plugin, but a consuming repo's hook config has no
`PLUGIN_ROOT` — that variable is set only for a plugin's own manifest. So **vendor a copy**
into the repo rather than pointing at the install directory, which also means the guardrail
survives a plugin uninstall or version bump.

1. Copy the sibling you need into your repo, e.g. `.github/hooks/scripts/`.
2. Add a repo-level hook config at `.github/hooks/neo-guardrails.json` (the CLI reads
   `.github/hooks/*.json`; the same schema can be inlined under a `hooks` key in repo
   `settings.json` or global `config.json`):

```jsonc
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      { "type": "command",
        "bash": "r=\"$(git rev-parse --show-toplevel 2>/dev/null)\"; s=\"$r/.github/hooks/scripts/enforce-guardrails.sh\"; [ -n \"$r\" ] && [ -f \"$s\" ] || exit 0; o=\"$(bash \"$s\" preToolUse)\"; c=$?; if [ \"$c\" -eq 0 ]; then [ -z \"$o\" ] || printf '%s\\n' \"$o\"; else printf 'Neo enforce-guardrails: hook exited %s; allowing (fail-open).\\n' \"$c\" >&2; fi; exit 0",
        "powershell": "$r = (git rev-parse --show-toplevel 2>$null); $s = \"$r/.github/hooks/scripts/enforce-guardrails.ps1\"; if (-not $r -or -not (Test-Path -LiteralPath $s)) { exit 0 }; $c = 127; $o = @(); try { $o = @(pwsh -NoProfile -ExecutionPolicy Bypass -File \"$s\" preToolUse); $c = $LASTEXITCODE } catch { }; if ($c -eq 0) { if ($o) { $o -join \"`n\" } } else { [Console]::Error.WriteLine(\"Neo enforce-guardrails: hook exited $c; allowing (fail-open).\") }; exit 0",
        "timeoutSec": 10 }
    ]
  }
}
```

The command is a **fail-open wrapper** around the script: a real deny still blocks, but an
infrastructure failure allows the call with a warning instead of denying every tool call. Four
parts of it matter, and the first two exist because their absence shipped a broken release.
Keep them if you adapt it:

- **The existence guard.** If the path does not resolve, `exit 0` rather than running a
  nonexistent script. The wrapper would turn the resulting failure into allow-with-warning
  anyway, but the guard keeps the missing-file case quiet and is still worth keeping.
- **The explicit interpreter, on both platforms.** The existence guard proves the file is there;
  it does not prove the OS will run it. On Windows, `& $s` runs a script file, which PowerShell
  execution policy governs, and the harness passes no `-ExecutionPolicy` flag. `-ExecutionPolicy
  Bypass` is **process-scoped** — it changes no machine, user, or persisted setting, and affects
  no other process. `pwsh` is guaranteed present because the harness itself spawns `pwsh.exe`.
  On POSIX, a bare `"$s"` execs the file and so requires the executable bit, which `[ -f "$s" ]`
  does not check; `bash "$s"` passes the script as an argument to an already-running interpreter,
  so neither the mode bit nor the shebang matters.
- **The repo-root anchor.** A bare relative path is resolved against the hook process's working
  directory, which is wherever the user launched the CLI — not necessarily the repo root. When it
  misses, the existence guard fires and enforcement is **silently off**. `git rev-parse
  --show-toplevel` anchors it. (The scripts themselves already resolve the branch against the
  *payload's* `cwd`, not the process's, for the same reason.)
- **The exit-code wrapper.** The scripts exit 0 on every verdict (deny is JSON on stdout plus
  exit 0; allow is empty stdout plus exit 0), so a **non-zero exit only ever means
  infrastructure failure** — a missing interpreter, an execution policy or GPO refusal, CRLF
  endings, a syntax error, a crash or kill. That is why the wrapper can tell the two apart
  without swallowing a real verdict:
  - Child exits 0 → its stdout is passed through verbatim, so a real deny still blocks.
  - Child exits non-zero → any partial stdout is discarded, one line
    `Neo enforce-guardrails: hook exited N; allowing (fail-open).` goes to stderr, and the
    wrapper exits 0.
  - The PowerShell form wraps the launch in `try`/`catch` and seeds `$c = 127`, so a failed
    launch (where `$LASTEXITCODE` is never read) reports a real exit code in the warning
    instead of an empty one. It fails open either way; the sentinel only makes the message
    useful.
  - **Trade-off:** a crash that would have denied now allows, with a warning. Enforcement fails
    *off*, visibly only on stderr. That is acceptable because this is a speed bump backed by
    server-side branch protection (see § Why they are opt-in).
  - **Strict alternative:** drop the wrapper and run `bash "$s" preToolUse` /
    `pwsh -NoProfile -ExecutionPolicy Bypass -File "$s" preToolUse` directly. Every non-zero
    exit then denies, so any launch failure or crash denies every tool call.
  - If the child exits 0 with non-JSON stdout, the wrapper passes it through unchanged (the Neo
    scripts never do this).

Keep the bash and PowerShell strings in sync if you adapt either. The nested `pwsh` launch in
the PowerShell form adds a few hundred ms per call, well inside `timeoutSec: 10`.

The tables below are **child** exit codes: the same script on the same machine, run under each
launch form shown in the column headers. In the wrapped form any non-zero becomes
allow-with-warning (enforcement off, with a stderr warning); the "denies everything" labels
describe the strict, unwrapped form. Windows, by effective execution policy:

| Effective policy | `& $s` | `pwsh -ExecutionPolicy Bypass -File "$s"` |
| --- | --- | --- |
| `Restricted` (Windows client default) | **1 — denies everything** | 0 |
| `AllSigned` | **1 — denies everything** | 0 |
| `RemoteSigned` | 0 | 0 |
| `Bypass` | 0 | 0 |

POSIX, by file state:

| File state | `"$s"` | `bash "$s"` |
| --- | --- | --- |
| mode 755, LF endings | 0 | 0 |
| mode 644 (executable bit lost) | **126 — denies everything** | 0 |
| CRLF line endings | **127 — denies everything** | **2 — denies everything** |

The last row is the exception that proves the rule: an explicit interpreter cannot rescue CRLF,
because bash itself chokes on the `\r`. With the wrapper, CRLF disables the guardrail (allow plus
a stderr warning) rather than bricking the session, so `*.sh text eol=lf` in `.gitattributes`
is still load-bearing rather than cosmetic, and still matters because this repo is developed on
Windows.

> **`-ExecutionPolicy` does not beat Group Policy.** The flag sets the **Process** scope, which
> ranks below `MachinePolicy` and `UserPolicy`. On a machine where an administrator has set the
> *Turn on Script Execution* GPO to `AllSigned` — or disabled it, equivalent to `Restricted` —
> an unsigned script still refuses to load and the hook still exits non-zero. The table above was
> measured across the process/user/machine scopes, not the GPO ones. On such a machine the shipped
> logging hooks merely fail open (they log nothing); with the wrapper, a `preToolUse` hook you opt
> into allows every call with a stderr warning (enforcement is off), whereas the strict form would
> deny every tool call. If you are on GPO-managed Windows, sign the scripts or verify before you
> rely on them — which § Verify tells you to do anyway.

Then verify it actually denies (see § Verify) — an untested guardrail is worse than none,
because it is believed.

## Copilot `preToolUse` command-hook contract

Verified against GitHub's [Copilot hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference).

- **Input** (stdin JSON, camelCase `preToolUse`): `{ sessionId, timestamp, cwd, toolName, toolArgs }`.
  The PascalCase `PreToolUse` variant uses `tool_name` / `tool_input`; the hook reads both.
- **Output** (stdout JSON) drives the decision:
  - `{"permissionDecision":"deny","permissionDecisionReason":"…"}` blocks the tool. The
    reason is **required** on deny and is shown to the agent.
  - Empty stdout (or `{"permissionDecision":"allow"}`) lets the tool run.
- **Exit code / failure semantics — this hook is blocking, so it is NOT globally fail-open
  like the logger:**
  - Command `preToolUse` hooks are **fail-closed on error**: any crash or **non-zero exit,
    including exit `2`**, denies the call — even if stdout says `allow`. The hook therefore
    always `exit 0` and expresses its verdict purely through the JSON. This is also why the
    opt-in wrapper always exits 0.
  - Command hook **timeouts always fail open** (the tool proceeds). This is unavoidable, so
    the hook is kept fast and dependency-light and `timeoutSec` is `10`.

> **Version caveat.** Command-hook denial has not worked in every Copilot CLI build (see
> [github/copilot-cli#3874](https://github.com/github/copilot-cli/issues/3874)). Confirm the
> deny path actually blocks in your installed CLI version; until then, treat server-side
> branch protection as the authoritative backstop.

## What the scripts enforce

They inspect the shell tool (`bash`/`powershell`) plus the two desktop-app host tools that can
open or un-draft a pull request. Every other tool (`view`, `edit`, `grep`, …) is allowed
immediately so enforcement never impedes normal work. The Unix hook parses the payload with
`python3` (already a repo dependency) rather than `jq`, so a missing `jq` cannot brick every
command; the PowerShell hook uses native `ConvertFrom-Json`.

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
string** — they would sail straight past the command patterns.

> **`toolArgs` may be a string.** The hook payload types `toolArgs` as `unknown`, and the
> runtime parses a JSON string into an object only "when possible". Both hooks therefore
> JSON-parse a string `toolArgs` before applying Rule B. Without that, the PowerShell hook
> could not see `draft` and denied *every* `create_pull_request` call, including correctly
> drafted ones — observed in the wild against a call that explicitly passed `draft: true`.
> Where the arguments still cannot be read, both hooks now **allow** with a stderr warning:
> arguments you cannot read are arguments you cannot judge, and that matches the
> unparseable-payload stance everywhere else in the script.

**Failure matrix:**

| Situation | Decision |
| --- | --- |
| Recognized blocked operation | **deny** (with reason) |
| Recognized safe operation | allow |
| Non-shell tool | allow |
| Payload unparseable (or `python3` absent on Unix) | allow + stderr warning |
| Host-tool `toolArgs` present but unreadable (not JSON, not an object) | allow + stderr warning |
| Script exits 0 with deny JSON | **deny** (wrapper passes it through) |
| Hook script missing at the wired path | allow (existence guard in the hook command) |
| Interpreter, execution policy, or a missing executable bit refuses to run the script | allow + stderr warning (wrapper); **deny** in the strict form |
| Script present but crashes | allow + stderr warning (wrapper); **deny** in the strict form |
| Hook times out | allow (harness fail-open) |

The unparseable case is a **deliberate** fail-open inside the script: denying every tool call
on a parser glitch would brick the session, and branch protection is the real backstop.

The two launch-failure and crash rows are the dangerous ones, and neither can be fixed from
inside the script — by definition the script is not running or has died. Only the hook command
can handle them, which is why the opt-in snippet carries the existence guard, the explicit
interpreter, and the exit-code wrapper. The scripts exit 0 on every verdict, so a non-zero exit
always means infrastructure failure, never "ran and denied". That is what lets the wrapper
convert a crash into allow-with-warning without swallowing a real verdict. Without the wrapper
(the strict form), a crashing script fails closed.

## Denial records

Every deny also appends **one** record to the observability log, so a team that opted in can
answer how often the guardrail fired and which rule did it. It goes to the same file the
logger writes — `$AGENT_LOG_DIR/events.jsonl`, default `~/.agent-logs/events.jsonl` — and
`run` follows the logger's fallback order (see [observability.md](observability.md)), so denial
records join the logger's records for the same run:

```json
{"ts":"2026-10-26T20:55:11Z","run":"feat/42-login","session":"…","event":"guardrailDenied","tool":"bash","rule":"A1-push-protected-ref","decision":"deny","reason":"protected_branch"}
```

| `rule` (stable id) | `reason` | Fires on |
| --- | --- | --- |
| `A1-push-protected-ref` | `protected_branch` | `git push` with a `main`/`master` refspec |
| `A2-commit-on-protected-branch` | `protected_branch` | `git commit` / bare `git push` while HEAD is `main`/`master` |
| `B1-gh-pr-create-not-draft` | `draft_only` | `gh pr create` without `--draft` |
| `B2-gh-pr-ready` | `draft_only` | `gh pr ready` |
| `B3-host-create-pr-not-draft` | `draft_only` | host `create_pull_request` without `draft: true` |
| `B4-host-update-pr-undraft` | `draft_only` | host `update_pull_request` with `draft: false` |

**Privacy boundary.** The record holds derived fields only. The command string, file
contents, tool arguments, and the human-readable `permissionDecisionReason` are **never**
written (see [`../reference/hook-contract.md`](../reference/hook-contract.md) § Handling
sensitive payloads). `tool` and `session` come from the payload, so both are reduced to
`[A-Za-z0-9._:/-]` and capped (64 and 128 characters). Allowed calls write nothing.

**It cannot change the verdict.** The record is written *after* the deny JSON, every stream of
the write is discarded, and any failure — unwritable or non-directory `AGENT_LOG_DIR`, missing
`git`, a full disk — is swallowed, so stdout still carries only the permission JSON and the
exit code is still 0. Neither script needs `jq` (bash uses the `python3` it already requires;
PowerShell uses native JSON). Set `NEO_LOG_HOOKS=0` (also `off`/`false`/`no`) to turn the
records off without touching enforcement.

**Duplicates (#75).** Neither plugin registers this hook — the shipped `hooks.json` files wire
only `log-event` — so installing both `neo-core` and `neo-product` does **not** duplicate denial
records. They come from this script, not from `log-event.sh`/`.ps1`, so the per-event claim-file
de-duplication added to the logger for #75 (PR #130) does **not** cover them: the script writes one record
per invocation with no de-duplication. If you register the guardrail more than once (for example
in both `.github/hooks/*.json` and a global `config.json`), a single denied call **will** write
one record per registration. Register it once, or count distinct `(ts, session, rule)`.

## Relaxing enforcement

Once you have opted in, interaction with the per-session enablement levers from the
observability set (#4):

- **Neo escape hatch:** set `NEO_ENFORCE_GUARDRAILS=0` (also `off`/`false`/`no`) to make the
  hook allow everything. Use it for legitimate exceptions (e.g. a maintenance task that must
  touch `main`). Note this only works when the script **runs** — it cannot rescue a hook that
  failed to launch (with the wrapper, a failed launch already allows with a warning).
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

Pipe a sample payload through the hook and check the decision. The comments show the shape of
the output, not its exact bytes: the bash script prints the JSON with a space after each colon
and comma, the PowerShell script prints it compact.

```bash
printf '{"toolName":"bash","toolArgs":{"command":"git push origin main"}}' \
  | hooks/scripts/enforce-guardrails.sh preToolUse
# => {"permissionDecision": "deny", "permissionDecisionReason": "Neo guardrail: pushing to 'main'…"}

printf '{"toolName":"bash","toolArgs":{"command":"gh pr create --draft"}}' \
  | hooks/scripts/enforce-guardrails.sh preToolUse
# => (empty stdout == allow)

printf '{"toolName":"create_pull_request","toolArgs":{"title":"x"}}' \
  | hooks/scripts/enforce-guardrails.sh preToolUse
# => {"permissionDecision": "deny", "permissionDecisionReason": "Neo guardrail: agents open DRAFT…"}
```

Test the **whole hook command**, not just the script — the failure this page exists to prevent
lives in the command, not the script. The snippets below are the unescaped forms of the wrapped
command from § Opting in, so run them from inside the repo that vendored the scripts (the
command anchors on `git rev-parse --show-toplevel`). Each expects the **deny JSON and exit 0**,
then a **fail-open check** against a child that exits non-zero.

On Windows:

```powershell
$cmd = '$r = (git rev-parse --show-toplevel 2>$null); $s = "$r/.github/hooks/scripts/enforce-guardrails.ps1"; if (-not $r -or -not (Test-Path -LiteralPath $s)) { exit 0 }; $c = 127; $o = @(); try { $o = @(pwsh -NoProfile -ExecutionPolicy Bypass -File "$s" preToolUse); $c = $LASTEXITCODE } catch { }; if ($c -eq 0) { if ($o) { $o -join "`n" } } else { [Console]::Error.WriteLine("Neo enforce-guardrails: hook exited $c; allowing (fail-open).") }; exit 0'
'{"toolName":"bash","toolArgs":{"command":"git push origin main"}}' |
  pwsh -nop -nol -ExecutionPolicy Restricted -c $cmd
$LASTEXITCODE
# => the deny JSON, and exit code 0.
```

`-ExecutionPolicy Restricted` on the outer process reproduces the stock-Windows-client
condition, because process scope is inherited by children unless they set their own. The
wrapped command still prints the deny JSON, since the inner `pwsh` sets its own `Bypass`.

Fail-open check, reusing `$cmd` from above — swap in a child that exits non-zero, then restore
it. If you interrupt this block, restore the script yourself with `Move-Item -Force "$s.bak" $s`,
or the vendored guardrail stays stubbed out:

```powershell
$s = "$(git rev-parse --show-toplevel)/.github/hooks/scripts/enforce-guardrails.ps1"
Copy-Item $s "$s.bak"; Set-Content $s 'exit 3'
'{"toolName":"bash","toolArgs":{"command":"git push origin main"}}' |
  pwsh -nop -nol -c $cmd
$LASTEXITCODE
Move-Item -Force "$s.bak" $s
# => empty stdout, "Neo enforce-guardrails: hook exited 3; allowing (fail-open)." on stderr,
#    exit code 0. The strict (unwrapped) form would exit 3 here and deny the call.
```

On macOS or Linux, the command contains single quotes, so load it with a quoted heredoc rather
than a single-quoted string:

```bash
cmd=$(cat <<'EOF'
r="$(git rev-parse --show-toplevel 2>/dev/null)"; s="$r/.github/hooks/scripts/enforce-guardrails.sh"; [ -n "$r" ] && [ -f "$s" ] || exit 0; o="$(bash "$s" preToolUse)"; c=$?; if [ "$c" -eq 0 ]; then [ -z "$o" ] || printf '%s\n' "$o"; else printf 'Neo enforce-guardrails: hook exited %s; allowing (fail-open).\n' "$c" >&2; fi; exit 0
EOF
)
printf '%s' '{"toolName":"bash","toolArgs":{"command":"git push origin main"}}' | bash -c "$cmd"
echo "exit=$?"
# => the deny JSON, and exit=0.
```

Fail-open check, reusing `cmd` from above — swap in a child that exits non-zero, then restore
it. If you interrupt this block, restore the script yourself with `mv "$s.bak" "$s"`, or the
vendored guardrail stays stubbed out:

```bash
s="$(git rev-parse --show-toplevel)/.github/hooks/scripts/enforce-guardrails.sh"
cp "$s" "$s.bak"; printf 'exit 3\n' > "$s"
printf '%s' '{"toolName":"bash","toolArgs":{"command":"git push origin main"}}' | bash -c "$cmd"
echo "exit=$?"
mv "$s.bak" "$s"
# => empty stdout, "Neo enforce-guardrails: hook exited 3; allowing (fail-open)." on stderr,
#    exit=0. The strict (unwrapped) form would exit 3 here and deny the call.
```

To reproduce the macOS lost-executable-bit condition, strip the bit and rerun the first check:

```bash
chmod 644 .github/hooks/scripts/enforce-guardrails.sh
# => still the deny JSON and exit=0, because `bash "$s"` does not need the executable bit.
#    A bare `"$s"` would exit 126: allow + warning in the wrapped form, a blanket denial in
#    the strict form (the macOS bug).
```

Then restore the bit: `chmod 755 .github/hooks/scripts/enforce-guardrails.sh`

