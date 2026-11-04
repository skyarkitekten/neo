<#
.SYNOPSIS
  Unset the env vars setup-hook-env.ps1 set.

.DESCRIPTION
  Clears PLUGIN_ROOT (plus the COPILOT_/CLAUDE_ aliases) and AGENT_LOG_DIR,
  plus any AGENT_RUN_ID you set yourself. Does not delete the log directory or
  its contents.

  DOT-SOURCE this so the vars clear from your current shell:
      . .\scripts\teardown-hook-env.ps1
#>

Remove-Item Env:PLUGIN_ROOT, Env:COPILOT_PLUGIN_ROOT, Env:CLAUDE_PLUGIN_ROOT, `
    Env:AGENT_LOG_DIR, Env:AGENT_RUN_ID -ErrorAction SilentlyContinue

Write-Host 'Neo hook env cleared: PLUGIN_ROOT, COPILOT_PLUGIN_ROOT, CLAUDE_PLUGIN_ROOT, AGENT_LOG_DIR, AGENT_RUN_ID'
