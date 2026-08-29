<#
.SYNOPSIS
  Windows / PowerShell sibling of log-event.sh. Appends one JSONL record per agent
  lifecycle event so you can tune the .agent.md prompts from data, not guesses.

.DESCRIPTION
  Design: fast, append-only, fail-open — logging must never block or slow a turn.
  Reads the event payload as JSON on stdin (Copilot passes JSON this way) and writes
  a compact record to $AGENT_LOG_DIR/events.jsonl.

  Uses native PowerShell JSON (ConvertFrom-Json / ConvertTo-Json) so it has NO `jq`
  dependency — that is the whole point of the PowerShell path on Windows.

  Env:
    AGENT_LOG_DIR  where to write logs   (default: $HOME/.agent-logs)
    AGENT_RUN_ID   correlation key       (default: current git branch)

  NOTE: the field fallbacks below (agent_name, tool_name, ...) are defensive guesses
  across harnesses, mirroring log-event.sh. Verify them against your harness's real
  payload once and trim to what's there.
#>

param(
    [string]$Event = 'unknown'
)

# Fail-open: nothing here may throw out to the harness.
$ErrorActionPreference = 'SilentlyContinue'

try {
    $logDir = if ($env:AGENT_LOG_DIR) { $env:AGENT_LOG_DIR } else { Join-Path $HOME '.agent-logs' }
    $logFile = Join-Path $logDir 'events.jsonl'

    $runId = $env:AGENT_RUN_ID
    if (-not $runId) {
        $runId = (& git rev-parse --abbrev-ref HEAD 2>$null)
        if ($runId -is [array]) { $runId = $runId[0] }
        $runId = ("$runId").Trim()
    }
    if (-not $runId) { $runId = 'unknown' }

    $ts = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')

    if (-not (Test-Path -LiteralPath $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }

    $raw = [Console]::In.ReadToEnd()

    function Get-Prop($obj, [string[]]$names) {
        if ($null -eq $obj) { return $null }
        foreach ($n in $names) {
            $p = $obj.PSObject.Properties[$n]
            if ($p -and $null -ne $p.Value) { return $p.Value }
        }
        return $null
    }

    $data = $null
    if ($raw -and $raw.Trim()) {
        try { $data = $raw | ConvertFrom-Json -ErrorAction Stop } catch { $data = $null }
    }

    if ($null -ne $data) {
        # Curated record with cross-harness fallbacks.
        $status = Get-Prop $data @('status', 'result_status')
        if ($null -eq $status) {
            $success = Get-Prop $data @('success')
            if ($null -ne $success) { $status = if ($success) { 'ok' } else { 'error' } }
        }
        if ($null -eq $status -and $null -ne (Get-Prop $data @('error'))) { $status = 'error' }

        $prompt = Get-Prop $data @('prompt', 'user_prompt', 'content', 'message', 'input')
        if ($prompt -is [string] -and $prompt.Length -gt 500) { $prompt = $prompt.Substring(0, 500) }

        $record = [ordered]@{
            ts      = $ts
            run     = $runId
            event   = $Event
            agent   = Get-Prop $data @('agent_name', 'agentName', 'agent')
            tool    = Get-Prop $data @('tool_name', 'toolName', 'tool')
            status  = $status
            session = Get-Prop $data @('session_id', 'sessionId')
            prompt  = $prompt
        }
    } else {
        # Unexpected shape — keep a minimal raw record so no event is silently dropped.
        $rawTrunc = if ($raw) { $raw.Substring(0, [Math]::Min(2000, $raw.Length)) } else { '' }
        $record = [ordered]@{
            ts          = $ts
            run         = $runId
            event       = $Event
            parse_error = $true
            raw         = $rawTrunc
        }
    }

    $line = $record | ConvertTo-Json -Compress -Depth 10
    Add-Content -LiteralPath $logFile -Value $line -Encoding utf8
} catch {
    # Fail-open: never surface an error to the harness.
}

# Emit the explicit continue signal so a logging hook never stalls a turn.
# (Empty stdout also means "continue", but being explicit matches the contract.)
Write-Output '{"continue":true}'
exit 0
