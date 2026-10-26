<#
.SYNOPSIS
  Copilot CLI preToolUse enforcement hook (Windows / PowerShell sibling of
  enforce-guardrails.sh). Blocks the two AGENTS.md guardrails that must hold at the
  harness level, not merely in a prompt:

    Rule A - never commit or push to `main` (or `master`).
    Rule B - agents open DRAFT pull requests only. Enforced against both `gh pr create`
             and the desktop app's create_pull_request / update_pull_request host tools,
             which carry structured args rather than a shell command and so would
             otherwise sail past the command patterns entirely.

.NOTES
  Contract (see docs/contributing/guides/enforcement.md and GitHub's Copilot hooks reference):
    * Input: JSON on stdin - { sessionId, timestamp, cwd, toolName, toolArgs }
      (PascalCase PreToolUse uses tool_name / tool_input; both are read).
    * Output: a single JSON object on stdout describing the decision:
        {"permissionDecision":"deny","permissionDecisionReason":"..."}   -> block
        (empty stdout)                                                    -> allow
      permissionDecisionReason is REQUIRED on deny.
    * Command preToolUse hooks are FAIL-CLOSED on error: any crash or non-zero exit
      denies the call regardless of stdout. So this script always exits 0 and expresses
      its verdict purely through the JSON. Timeouts always fail OPEN - keep it fast.

  Deliberate failure behavior (issue #42): decisive for operations it understands, but if
  the payload can't be parsed it ALLOWS with a stderr warning rather than denying every
  tool call and bricking the session. Server-side branch protection is the real backstop.

  Denial records (issue #98): every deny also appends ONE derived-fields-only record
  ({ts, run, session, event:"guardrailDenied", tool, rule, decision, reason}) to the
  observability log, $AGENT_LOG_DIR/events.jsonl (default $HOME/.agent-logs). The raw
  payload, command string, and file contents are never written. Logging is best-effort and
  silent: it cannot change the deny JSON on stdout or the exit code. NEO_LOG_HOOKS=0 turns
  it off. See docs/contributing/guides/enforcement.md - Denial records.

  Relaxation: set NEO_ENFORCE_GUARDRAILS=0 (or "off"/"false"/"no") to disable. Other levers
  live at the harness layer - see docs/contributing/guides/enforcement.md.
#>

$ErrorActionPreference = 'Stop'

function Allow {
    # Empty stdout == allow.
    exit 0
}

function ConvertTo-SafeToken($value, [int]$cap) {
    # Restricted charset + length cap: these values come from the payload.
    $v = ("$value") -replace '[^A-Za-z0-9._:/-]', '_'
    if ($v.Length -gt $cap) { $v = $v.Substring(0, $cap) }
    if ($v) { return $v }
    return $null
}

# Append one guardrailDenied record. Derived fields only - never the payload or command.
# Everything is swallowed and nothing is written to the pipeline, so stdout carries only the
# permission JSON and the exit code is unaffected.
function Write-DenialLog([string]$Rule, [string]$ReasonCode) {
    try {
        if (@('0', 'off', 'false', 'no') -contains ("$env:NEO_LOG_HOOKS").ToLowerInvariant()) { return }
        $logDir = if ($env:AGENT_LOG_DIR) { $env:AGENT_LOG_DIR } else { Join-Path $HOME '.agent-logs' }
        # Same "run" fallback as log-event.ps1 (issue #99): AGENT_RUN_ID -> branch of payload
        # cwd -> branch of hook cwd -> session -> unknown. Detached HEAD counts as no branch.
        $branchOf = {
            param([string]$dir)
            try {
                $b = if ($dir) { & git -C $dir rev-parse --abbrev-ref HEAD 2>$null } else { & git rev-parse --abbrev-ref HEAD 2>$null }
                if ($LASTEXITCODE -ne 0) { return '' }
                if ($b -is [array]) { $b = $b[0] }
                $b = ("$b").Trim()
                if ($b -eq 'HEAD') { return '' }
                return $b
            } catch { return '' }
        }
        $runId = $env:AGENT_RUN_ID
        if (-not $runId -and $script:cwd -and (Test-Path -LiteralPath $script:cwd -PathType Container)) {
            $runId = & $branchOf $script:cwd
        }
        if (-not $runId) { $runId = & $branchOf '' }
        if (-not $runId -and $script:session) { $runId = "$($script:session)" }
        if (-not $runId) { $runId = 'unknown' }
        if ($runId.Length -gt 200) { $runId = $runId.Substring(0, 200) }
        $record = [ordered]@{
            ts       = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
            run      = $runId
            session  = ConvertTo-SafeToken $script:session 128
            event    = 'guardrailDenied'
            tool     = ConvertTo-SafeToken $script:tool 64
            rule     = $Rule
            decision = 'deny'
            reason   = $ReasonCode
        }
        $line = $record | ConvertTo-Json -Compress
        if (-not (Test-Path -LiteralPath $logDir)) {
            New-Item -ItemType Directory -Path $logDir -Force | Out-Null
        }
        [System.IO.File]::AppendAllText((Join-Path $logDir 'events.jsonl'), $line + "`n")
    } catch {
        # Fail silent: a logging failure must never change the decision.
    }
}

function Deny([string]$Rule, [string]$ReasonCode, [string]$Reason) {
    # $Rule / $ReasonCode are logged; $Reason is shown to the agent and never logged.
    $obj = [ordered]@{
        permissionDecision       = 'deny'
        permissionDecisionReason = $Reason
    }
    # -Compress keeps it a single line; matches the bash hook's output shape.
    Write-Output ($obj | ConvertTo-Json -Compress)
    Write-DenialLog $Rule $ReasonCode
    exit 0
}

# Escape hatch: intentionally relax enforcement.
switch (($env:NEO_ENFORCE_GUARDRAILS)) {
    '0'     { Allow }
    'off'   { Allow }
    'OFF'   { Allow }
    'false' { Allow }
    'FALSE' { Allow }
    'no'    { Allow }
    'NO'    { Allow }
}

# Read the entire stdin payload.
try {
    $raw = [Console]::In.ReadToEnd()
} catch {
    $raw = ''
}

# Parse JSON. On any failure, fail OPEN with a warning (deliberate - see notes).
$data = $null
if ($raw -and $raw.Trim()) {
    try {
        $data = $raw | ConvertFrom-Json -ErrorAction Stop
    } catch {
        $data = $null
    }
}
if ($null -eq $data) {
    [Console]::Error.WriteLine('Neo enforce-guardrails: unparseable preToolUse payload; allowing.')
    Allow
}

function Get-Prop($obj, [string[]]$names) {
    foreach ($n in $names) {
        $p = $obj.PSObject.Properties[$n]
        if ($p -and $null -ne $p.Value) { return $p.Value }
    }
    return $null
}

# camelCase (preToolUse) and VS Code / PascalCase (PreToolUse) shapes.
$tool = Get-Prop $data @('toolName', 'tool_name')
if ($null -eq $tool) { $tool = '' }
$argsObj = Get-Prop $data @('toolArgs', 'tool_input')
$cwd = Get-Prop $data @('cwd')
if ($null -eq $cwd) { $cwd = '' }
$session = Get-Prop $data @('sessionId', 'session_id')

# `toolArgs` is typed `unknown` and the runtime parses a JSON string only "when possible",
# so it can arrive as a raw string. Parse it here or the host-tool rule below judges a PR
# on fields it cannot see and denies a correctly-drafted one.
if ($argsObj -is [string]) {
    $trimmed = ([string]$argsObj).Trim()
    if ($trimmed.StartsWith('{')) {
        try { $argsObj = $trimmed | ConvertFrom-Json -ErrorAction Stop } catch { }
    }
}

# Extract the shell command text from the tool arguments.
$cmd = ''
if ($argsObj -is [string]) {
    $cmd = $argsObj
} elseif ($null -ne $argsObj) {
    $val = Get-Prop $argsObj @('command', 'script', 'cmd', 'commandLine', 'input')
    if ($val -is [string] -and $val) {
        $cmd = $val
    } else {
        # Fall back to the whole arg object so patterns can still be matched.
        try { $cmd = ($argsObj | ConvertTo-Json -Compress -Depth 20) } catch { $cmd = '' }
    }
}

# Rule B for desktop-app host tools. The Copilot desktop app registers its own tools
# (create_session, create_pull_request, ...) which carry structured args rather than a
# shell command, so the command patterns below can't see them. Enforce here or the host
# PR tools route straight around the draft-only guardrail.
if ([string]$tool -eq 'create_pull_request' -or [string]$tool -eq 'update_pull_request') {
    # Args we cannot read are args we cannot judge. Fail OPEN with a warning, matching the
    # unparseable-payload stance above and the Unix sibling — denying on an unrecognized
    # payload shape would block every PR the tool opens, correctly drafted or not.
    if ($null -eq $argsObj -or $argsObj -is [string]) {
        [Console]::Error.WriteLine("Neo enforce-guardrails: unreadable toolArgs for $tool; allowing.")
        Allow
    }
    $draft = Get-Prop $argsObj @('draft')
    if ([string]$tool -eq 'create_pull_request') {
        if ($draft -ne $true) {
            Deny 'B3-host-create-pr-not-draft' 'draft_only' "Neo guardrail: agents open DRAFT pull requests only. Call create_pull_request with draft: true (or use 'gh pr create --draft'). To override intentionally, set NEO_ENFORCE_GUARDRAILS=0."
        }
    } elseif ($draft -eq $false) {
        Deny 'B4-host-update-pr-undraft' 'draft_only' "Neo guardrail: agents must not take a PR out of draft; leave it a draft for a human. Override with NEO_ENFORCE_GUARDRAILS=0."
    }
}

# Beyond that, only shell tools carry commands we enforce against. Everything else runs freely.
$shellTools = @('bash', 'powershell', 'Bash', 'shell', 'run_in_terminal')
if ($shellTools -notcontains [string]$tool) { Allow }

if (-not $cmd) { Allow }

# Normalize whitespace for matching (case-sensitive, mirroring the bash grep -E).
$norm = ($cmd -replace '[\s]+', ' ').Trim()

# ---------------------------------------------------------------------------
# Rule B - draft-PR-only.
# ---------------------------------------------------------------------------
if ($norm -cmatch '(^|[;&|\s])gh\s+pr\s+create(\s|$)') {
    if ($norm -cnotmatch '(^|\s)(--draft|-d)(\s|=|$)') {
        Deny 'B1-gh-pr-create-not-draft' 'draft_only' "Neo guardrail: agents open DRAFT pull requests only. Re-run 'gh pr create' with --draft. To override intentionally, set NEO_ENFORCE_GUARDRAILS=0."
    }
}

if ($norm -cmatch '(^|[;&|\s])gh\s+pr\s+ready(\s|$)') {
    Deny 'B2-gh-pr-ready' 'draft_only' "Neo guardrail: agents must not mark a PR ready for review ('gh pr ready'); leave it a draft for a human. Override with NEO_ENFORCE_GUARDRAILS=0."
}

# ---------------------------------------------------------------------------
# Rule A - never commit or push to main/master.
# ---------------------------------------------------------------------------

# A1: explicit push refspec targeting main/master from ANY branch, e.g.
#     git push origin main | git push origin HEAD:main | git push origin :master
if ($norm -cmatch '(^|[;&|\s])git\s+push\b') {
    if ($norm -cmatch '(^|[\s:])(main|master)(\s|$)') {
        Deny 'A1-push-protected-ref' 'protected_branch' "Neo guardrail: pushing to 'main'/'master' is blocked. Push your feature branch instead and open a draft PR. Override with NEO_ENFORCE_GUARDRAILS=0."
    }
}

# A2: commit or bare push while HEAD is on main/master.
if ($norm -cmatch '(^|[;&|\s])git\s+(commit|push)\b') {
    $branch = $null
    try {
        if ($cwd -and (Test-Path -LiteralPath $cwd)) {
            $branch = (& git -C $cwd rev-parse --abbrev-ref HEAD 2>$null)
        } else {
            $branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
        }
    } catch {
        $branch = $null
    }
    if ($branch -is [array]) { $branch = $branch[0] }
    $branch = ("$branch").Trim()
    if ($branch -eq 'main' -or $branch -eq 'master') {
        Deny 'A2-commit-on-protected-branch' 'protected_branch' "Neo guardrail: you are on '$branch'; committing or pushing to it is blocked. Create a feature branch first. Override with NEO_ENFORCE_GUARDRAILS=0."
    }
}

Allow
