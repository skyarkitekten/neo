#!/usr/bin/env bash
# setup-hook-env.sh [plugin-root]
#
# Set the env vars the neo-core hook scripts read, for local testing:
#   PLUGIN_ROOT (+ COPILOT_/CLAUDE_ aliases), AGENT_LOG_DIR (created), and
#   AGENT_RUN_ID (the correlation id, defaulted to the current git branch to
#   match the hooks' own fallback).
#
# DOT-SOURCE this so the vars land in your current shell:
#     source scripts/setup-hook-env.sh
#     source scripts/setup-hook-env.sh /path/to/some/plugin-root
#
# Executing it normally (./scripts/setup-hook-env.sh) only sets the vars in a
# child process that then exits — your shell sees nothing.

_neo_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_neo_repo_root="$(cd "$_neo_script_dir/.." && pwd)"

PLUGIN_ROOT="${1:-$_neo_repo_root/plugins/neo-core}"
export PLUGIN_ROOT
export COPILOT_PLUGIN_ROOT="$PLUGIN_ROOT"
export CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT"

export AGENT_LOG_DIR="${AGENT_LOG_DIR:-$HOME/.agent-logs}"
mkdir -p "$AGENT_LOG_DIR" 2>/dev/null

AGENT_RUN_ID="$(git -C "$_neo_repo_root" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
[ -n "$AGENT_RUN_ID" ] || AGENT_RUN_ID="unknown"
export AGENT_RUN_ID

printf 'Neo hook env set:\n'
printf '  PLUGIN_ROOT   = %s\n' "$PLUGIN_ROOT"
printf '  AGENT_LOG_DIR = %s\n' "$AGENT_LOG_DIR"
printf '  AGENT_RUN_ID  = %s\n' "$AGENT_RUN_ID"

unset _neo_script_dir _neo_repo_root
