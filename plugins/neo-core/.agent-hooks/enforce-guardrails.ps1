<#
.SYNOPSIS
  Copilot CLI preToolUse enforcement hook (Windows / PowerShell sibling of
  enforce-guardrails.sh). Blocks the two AGENTS.md guardrails that must hold at the
  harness level, not merely in a prompt:

    Rule A - never commit or push to `main` (or `master`).
    Rule B - agents open DRAFT pull requests only.

.NOTES
  Contract (see docs/enforcement.md and GitHub's Copilot hooks reference):
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

  Relaxation: set NEO_ENFORCE_GUARDRAILS=0 (or "off"/"false"/"no") to disable. Other levers
  live at the harness layer - see docs/enforcement.md.
#>

$ErrorActionPreference = 'Stop'

function Allow {
    # Empty stdout == allow.
    exit 0
}

function Deny([string]$Reason) {
    $obj = [ordered]@{
        permissionDecision       = 'deny'
        permissionDecisionReason = $Reason
    }
    # -Compress keeps it a single line; matches the bash hook's output shape.
    Write-Output ($obj | ConvertTo-Json -Compress)
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
    [Console]::Error.WriteLine('neo enforce-guardrails: unparseable preToolUse payload; allowing.')
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

# Only shell tools carry commands we enforce against. Everything else runs freely.
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
        Deny "Neo guardrail: agents open DRAFT pull requests only. Re-run 'gh pr create' with --draft. To override intentionally, set NEO_ENFORCE_GUARDRAILS=0."
    }
}

if ($norm -cmatch '(^|[;&|\s])gh\s+pr\s+ready(\s|$)') {
    Deny "Neo guardrail: agents must not mark a PR ready for review ('gh pr ready'); leave it a draft for a human. Override with NEO_ENFORCE_GUARDRAILS=0."
}

# ---------------------------------------------------------------------------
# Rule A - never commit or push to main/master.
# ---------------------------------------------------------------------------

# A1: explicit push refspec targeting main/master from ANY branch, e.g.
#     git push origin main | git push origin HEAD:main | git push origin :master
if ($norm -cmatch '(^|[;&|\s])git\s+push\b') {
    if ($norm -cmatch '(^|[\s:])(main|master)(\s|$)') {
        Deny "Neo guardrail: pushing to 'main'/'master' is blocked. Push your feature branch instead and open a draft PR. Override with NEO_ENFORCE_GUARDRAILS=0."
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
        Deny "Neo guardrail: you are on '$branch'; committing or pushing to it is blocked. Create a feature branch first. Override with NEO_ENFORCE_GUARDRAILS=0."
    }
}

Allow
