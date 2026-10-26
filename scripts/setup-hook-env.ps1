<#
.SYNOPSIS
  Set the env vars the neo-core hook scripts read, for local testing.

.DESCRIPTION
  Sets PLUGIN_ROOT (plus the COPILOT_/CLAUDE_ aliases) and AGENT_LOG_DIR (and
  creates it).

  AGENT_RUN_ID is deliberately NOT set: when it is unset the loggers derive
  "run" themselves (payload cwd's git branch -> hook cwd's branch -> session
  id). To pin one correlation id, set $env:AGENT_RUN_ID yourself before or
  after dot-sourcing; an existing value is left untouched.

  DOT-SOURCE this so the vars land in your current shell:
      . .\scripts\setup-hook-env.ps1
      . .\scripts\setup-hook-env.ps1 "C:\path\to\some\plugin-root"

  Running it normally (.\scripts\setup-hook-env.ps1) only sets the vars in the
  script's own child process, which then exits — your shell sees nothing.

.PARAMETER PluginRoot
  Optional override for PLUGIN_ROOT. Defaults to <repo>/plugins/neo-core.
#>
param([string]$PluginRoot)

$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $PluginRoot) { $PluginRoot = Join-Path $repoRoot 'plugins\neo-core' }

$env:PLUGIN_ROOT = $PluginRoot
$env:COPILOT_PLUGIN_ROOT = $PluginRoot
$env:CLAUDE_PLUGIN_ROOT = $PluginRoot

if (-not $env:AGENT_LOG_DIR) { $env:AGENT_LOG_DIR = Join-Path $HOME '.agent-logs' }
if (-not (Test-Path -LiteralPath $env:AGENT_LOG_DIR)) {
    New-Item -ItemType Directory -Path $env:AGENT_LOG_DIR -Force | Out-Null
}

Write-Host 'Neo hook env set:'
Write-Host "  PLUGIN_ROOT   = $env:PLUGIN_ROOT"
Write-Host "  AGENT_LOG_DIR = $env:AGENT_LOG_DIR"
if ($env:AGENT_RUN_ID) {
    Write-Host "  AGENT_RUN_ID  = $env:AGENT_RUN_ID (pre-set, kept)"
} else {
    Write-Host '  AGENT_RUN_ID  = (unset; loggers derive run from payload cwd/session)'
}
