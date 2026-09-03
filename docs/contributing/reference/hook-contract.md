# Hook contract

Normative contract for **hook manifests and hook scripts** shipped in a Neo plugin.
The JSON Schema at [`scripts/linting/schemas/hook-manifest.schema.json`](../../../scripts/linting/schemas/hook-manifest.schema.json)
is the machine-checkable half; this page is the prose half. `scripts/validate-plugins.py`
enforces both (CI runs it via `.github/workflows/validate.yml`).

For what the two shipped hook sets *do*, see the guides — this page owns the *shape*,
not the behavior:

- **fail-open observability logging** → [`guides/observability.md`](../guides/observability.md)
- **opt-in `preToolUse` enforcement** (shipped unregistered) → [`guides/enforcement.md`](../guides/enforcement.md)

## Layout

A plugin's hooks live under `plugins/<plugin>/hooks/`:

| Path | Purpose |
| --- | --- |
| `hooks/hooks.json` | The manifest — maps lifecycle events to commands. Copilot v1 schema. Declared by the `hooks` key in `plugin.json`. |
| `hooks/scripts/*.sh`, `hooks/scripts/*.ps1` | The scripts the manifest shells out to, one bash + one PowerShell sibling each. |

A plugin is self-contained: the manifest may only reference scripts inside its own
directory. See [`plugin-contract.md`](./plugin-contract.md) for the wider folder shape.

## The manifest

```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [
      { "type": "command",
        "bash": "s=\"${PLUGIN_ROOT}/hooks/scripts/log-event.sh\"; [ -f \"$s\" ] || exit 0; bash \"$s\" sessionStart",
        "powershell": "$s = \"$env:PLUGIN_ROOT/hooks/scripts/log-event.ps1\"; if (-not (Test-Path -LiteralPath $s)) { exit 0 }; pwsh -NoProfile -ExecutionPolicy Bypass -File \"$s\" sessionStart",
        "timeoutSec": 10 }
    ]
  }
}
```

- **`version` is `1`.** The only defined schema version.
- **A shipped plugin must not register a fail-closed event.** `preToolUse` denies the tool
  call when the hook exits non-zero, so any failure there — a stale path, a policy that won't
  load the script, a crash — denies *every* tool call, including read-only ones, and bricks
  the session. Ship the script and let the consuming repo wire it up; see
  [`guides/enforcement.md`](../guides/enforcement.md) § Opting in. The validator rejects it.
- **Guard the script's existence before invoking it.** A command that can't find its script
  exits non-zero, which is what a stale install or a component moved between releases
  produces (PR #93). Resolve the script into `$s`, `exit 0` when it's absent, and only then
  run it. Use separate `bash` and `powershell` properties for plugin scripts; the
  cross-platform `command` property cannot express a portable guard for both shells. The
  validator rejects cross-platform invocations and platform commands that do not follow the
  documented assignment → existence check → successful exit → invocation sequence.
- **Invoke the script through an explicit interpreter on both platforms.** Never `& $s`, and
  never a bare `"$s"`. The existence guard above proves the file is *there*; it does not prove
  the OS will *run* it, and each platform has its own way of refusing. Both have shipped as
  blanket tool-call denials (issue #95).

  On Windows, `& $s` runs a script **file**, which is exactly what PowerShell execution policy
  governs, and the harness launches hooks with no `-ExecutionPolicy` flag, so ambient policy
  applies. On a stock Windows client every scope is `Undefined`, which resolves to `Restricted`,
  and the file refuses to load (exit 1). Use
  `pwsh -NoProfile -ExecutionPolicy Bypass -File "$s" <event>`. The flag is **process-scoped**:
  it persists nothing and affects no other process, and `pwsh` is guaranteed present because
  the harness itself spawns `pwsh.exe`. It outranks the process, user, and machine scopes but
  **not** `MachinePolicy` / `UserPolicy` — a Group Policy that restricts script execution still
  refuses the file, and nothing process-scoped can override that.

  On macOS and Linux, `"$s"` execs the file, which requires the POSIX **executable bit** and a
  resolvable shebang. `[ -f "$s" ]` tests existence, not `-x`, so a file that lost its mode bit
  in transit sails past the guard and then fails exec with 126 (a bad shebang gives 127). Use
  `bash "$s" <event>`, which passes the script as an *argument* to an interpreter that is already
  running, so neither the mode bit nor the shebang is consulted.

  Quote `"$s"` on both so paths with spaces survive. Note that an explicit interpreter does
  **not** rescue CRLF line endings — bash still chokes on `\r` — so the `*.sh text eol=lf` rule
  in `.gitattributes` remains load-bearing, especially in a repo developed on Windows.
- **One camelCase block per event.** Copilot CLI reads the camelCase event key and
  the `bash` / `powershell` command properties. VS Code reads the PascalCase alias of the
  same event and maps `bash`→osx/linux, `powershell`→windows, so **one block covers
  both surfaces**. Do **not** also declare a PascalCase copy of the same event — VS Code
  would register and fire both, duplicating every invocation. The validator rejects it.
- **Allowed events.** Copilot CLI defines each event in two casings: a **camelCase**
  name whose payload uses camelCase fields, and a **PascalCase** alias whose payload uses
  snake_case fields to match the VS Code Copilot extension. They are the *same* event, not
  two events. Neo declares the camelCase form; the validator rejects a PascalCase copy of
  an event already declared in camelCase, because both would register and fire.

  | camelCase (declare this) | PascalCase alias | Fires when |
  | --- | --- | --- |
  | `sessionStart` | `SessionStart` | A new or resumed session begins. |
  | `sessionEnd` | `SessionEnd` | The session terminates. |
  | `userPromptSubmitted` | `UserPromptSubmit` | The user submits a prompt. |
  | `userPromptTransformed` | — | The runtime has transformed a prompt into model-facing content. |
  | `preToolUse` | `PreToolUse` | Before each tool executes. Can allow, deny, or modify. |
  | `postToolUse` | `PostToolUse` | After a tool completes successfully. |
  | `postToolUseFailure` | — | After a tool completes with a failure. |
  | `preCompact` | `PreCompact` | Context compaction is about to begin. |
  | `subagentStart` | — | A subagent is spawned, before it runs. |
  | `subagentStop` | `SubagentStop` | A subagent completes. |
  | `agentStop` | `Stop` | The main agent finishes a turn. |
  | `errorOccurred` | — | An error occurs during execution. |
  | `notification` | `Notification` | The CLI emits a system notification. Fire-and-forget. |
  | `permissionRequest` | — | Before the permission service runs. |

  There is no lowercase `userPromptSubmit` and no lowercase `stop` — those spellings are
  the PascalCase aliases mis-cased, and a hook declared under either name never fires.
  Anything outside this table is rejected by the validator.

### The `${PLUGIN_ROOT}` placeholder — per shell

Copilot exposes the plugin's install directory as the **`PLUGIN_ROOT` environment
variable** (also `COPILOT_PLUGIN_ROOT` / `CLAUDE_PLUGIN_ROOT`). How you read it differs by
shell, and getting it wrong is a silent break:

| Field | Correct | Wrong | Why |
| --- | --- | --- | --- |
| `bash` | `${PLUGIN_ROOT}` | — | bash expands the env var |
| `powershell` | `$env:PLUGIN_ROOT` | `${PLUGIN_ROOT}` | in PowerShell `${PLUGIN_ROOT}` is its *own* (undefined) variable and expands to empty, producing a bad path like `/hooks/scripts/log-event.ps1` |

`scripts/validate-plugins.py` fails the build if a bare `${PLUGIN_ROOT}` appears in any
`powershell` command string.

## Script contract

Every hook script — bash or PowerShell — follows the same rules:

- **Read the event payload as JSON on stdin.** Field names vary across surfaces
  (`toolName`/`tool_name`, etc.); read defensively.
- **Emit `{"continue":true}` on stdout on the normal path.** Empty stdout also means
  "continue", but a logging hook emits the signal explicitly so it can never stall a turn.
- **Self-locate; never depend on `PLUGIN_ROOT` internally.** A script finds its siblings
  from its own location (`$PSScriptRoot` in PowerShell, `$(dirname "${BASH_SOURCE[0]}")`
  in bash), not from the manifest placeholder. The placeholder only tells the harness
  which script to launch.
- **Be fast and dependency-light.** Respect the manifest `timeoutSec`; a hook that times
  out fails **open** (the tool call proceeds), so slow enforcement is no enforcement.
- **Line endings: `.sh` scripts must be LF.** A CRLF `.sh` fails on Linux/macOS bash with
  `$'\r': command not found`. The repo `.gitattributes` pins `*.sh text eol=lf`; do not
  override it.

### Fail-open vs fail-closed

The two hook sets deliberately differ, and each guide owns the detail:

- **Logging hooks fail *open*** — any error is swallowed and the script still exits 0.
  Observability must never block a turn. See [`guides/observability.md`](../guides/observability.md).
- **`preToolUse` enforcement hooks fail *closed* on crash** — a non-zero exit (including
  exit code 2) denies the tool call. So the enforce scripts always `exit 0` and express
  their verdict purely through stdout JSON
  (`{"permissionDecision":"deny","permissionDecisionReason":"…"}` to block, empty to
  allow). An **unparseable** payload is the one exception: it allows with a stderr warning
  rather than bricking the session. This contract is why Neo ships the enforcement scripts
  **unregistered** — the failure mode belongs to the consuming repo that chooses to accept
  it. See [`guides/enforcement.md`](../guides/enforcement.md).

## Handling sensitive payloads

Hook payloads can carry secrets: `preToolUse` inputs include full file contents and shell
command strings; `userPromptSubmit` includes the whole prompt. If a hook persists a
payload:

- Store the minimum needed — prefer derived signals (keys, lengths, counts, truncated
  previews) over verbatim values. The logger truncates `prompt` to 500 chars for this
  reason.
- Gate any verbatim capture behind its own explicit opt-in, defaulted off.
- Write to local, gitignored paths (`~/.agent-logs/…` by default), never to committed
  ones.

## Validation checklist

Before you open a PR that touches a hook:

1. `python3 scripts/validate-plugins.py` — schema + Neo-specific rules.
2. `bash -n plugins/*/hooks/scripts/*.sh` — shell syntax, and it surfaces stray CRLF.
3. Manually test both siblings with stdin redirected (see
   [`guides/observability.md`](../guides/observability.md) § Manual test).
