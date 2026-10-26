#!/usr/bin/env bash
# setup-hook-env.sh [plugin-root]
#
# Set the env vars the neo-core hook scripts read, for local testing:
#   PLUGIN_ROOT (+ COPILOT_/CLAUDE_ aliases) and AGENT_LOG_DIR (created).
#
# AGENT_RUN_ID is deliberately NOT set: when it is unset the loggers derive
# "run" themselves (payload cwd's git branch -> hook cwd's branch -> session
# id). To pin one correlation id, export AGENT_RUN_ID yourself before or after
# sourcing; an existing value is left untouched.
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


printf 'Neo hook env set:\n'
printf '  PLUGIN_ROOT   = %s\n' "$PLUGIN_ROOT"
printf '  AGENT_LOG_DIR = %s\n' "$AGENT_LOG_DIR"
if [ -n "${AGENT_RUN_ID:-}" ]; then
  printf '  AGENT_RUN_ID  = %s (pre-set, kept)\n' "$AGENT_RUN_ID"
else
  printf '  AGENT_RUN_ID  = (unset; loggers derive run from payload cwd/session)\n'
fi

unset _neo_script_dir _neo_repo_root
