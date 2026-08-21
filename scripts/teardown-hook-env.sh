#!/usr/bin/env bash
# teardown-hook-env.sh
#
# Unset the env vars setup-hook-env.sh set: PLUGIN_ROOT (+ COPILOT_/CLAUDE_
# aliases), AGENT_LOG_DIR, and AGENT_RUN_ID. Does not delete the log directory
# or its contents.
#
# DOT-SOURCE this so the vars clear from your current shell:
#     source scripts/teardown-hook-env.sh

unset PLUGIN_ROOT COPILOT_PLUGIN_ROOT CLAUDE_PLUGIN_ROOT AGENT_LOG_DIR AGENT_RUN_ID

printf 'Neo hook env cleared: PLUGIN_ROOT, COPILOT_PLUGIN_ROOT, CLAUDE_PLUGIN_ROOT, AGENT_LOG_DIR, AGENT_RUN_ID\n'
