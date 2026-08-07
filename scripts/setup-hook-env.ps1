<#
.SYNOPSIS
  Set the env vars the neo-core hook scripts read, for local testing.

.DESCRIPTION
  Sets PLUGIN_ROOT (plus the COPILOT_/CLAUDE_ aliases), AGENT_LOG_DIR (and
  creates it), and AGENT_RUN_ID (the correlation id, defaulted to the current
  git branch to match the hooks' own fallback).

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

$branch = (& git -C $repoRoot rev-parse --abbrev-ref HEAD 2>$null)
if ($branch -is [array]) { $branch = $branch[0] }
$branch = ("$branch").Trim()
if (-not $branch) { $branch = 'unknown' }
$env:AGENT_RUN_ID = $branch

Write-Host 'neo hook env set:'
Write-Host "  PLUGIN_ROOT   = $env:PLUGIN_ROOT"
Write-Host "  AGENT_LOG_DIR = $env:AGENT_LOG_DIR"
Write-Host "  AGENT_RUN_ID  = $env:AGENT_RUN_ID"
