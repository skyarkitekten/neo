#!/usr/bin/env python3
"""Validate that every shipped neo plugin mirrors correctly across harnesses.

Neo ships each plugin twice — once per harness — from one source tree. The
characteristic defect of this repo is one tree edited without the other. This
script makes the mirror invariant executable:

  * every plugin has BOTH manifests (a missing Copilot manifest is an ERROR,
    not a warning — Copilot silently falls back to the Claude manifest it can't
    read correctly);
  * the Copilot and Claude agent rosters match role-for-role;
  * the Copilot and Claude skill sets match name-for-name;
  * every manifest is valid JSON.

Exit code 0 = all good, 1 = at least one violation. No third-party deps.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PLUGINS_DIR = REPO_ROOT / "plugins"

errors: list[str] = []


def check_json(path: Path) -> None:
    try:
        json.loads(path.read_text())
    except FileNotFoundError:
        errors.append(f"missing manifest: {path.relative_to(REPO_ROOT)}")
    except json.JSONDecodeError as exc:
        errors.append(f"invalid JSON: {path.relative_to(REPO_ROOT)} — {exc}")


def copilot_agent_roles(plugin: Path) -> set[str]:
    d = plugin / ".github" / "agents"
    if not d.is_dir():
        return set()
    return {f.name[len("neo.") : -len(".agent.md")] for f in d.glob("neo.*.agent.md")}


def claude_agent_roles(plugin: Path) -> set[str]:
    d = plugin / "agents"
    if not d.is_dir():
        return set()
    return {f.name[len("neo-") : -len(".md")] for f in d.glob("neo-*.md")}


def skill_names(skills_dir: Path) -> set[str]:
    if not skills_dir.is_dir():
        return set()
    return {p.parent.name for p in skills_dir.glob("*/SKILL.md")}


def check_plugin(plugin: Path) -> None:
    name = plugin.name

    # 1. Both manifests must exist and parse. Missing Copilot manifest is an error.
    check_json(plugin / ".github" / "plugin" / "plugin.json")
    check_json(plugin / ".claude-plugin" / "plugin.json")

    # 2. Agent rosters must match role-for-role.
    cop, cla = copilot_agent_roles(plugin), claude_agent_roles(plugin)
    for role in sorted(cop - cla):
        errors.append(f"[{name}] agent '{role}' has a Copilot file but no Claude mirror")
    for role in sorted(cla - cop):
        errors.append(f"[{name}] agent '{role}' has a Claude file but no Copilot mirror")

    # 3. Skill sets must match name-for-name.
    cop_sk = skill_names(plugin / ".github" / "skills")
    cla_sk = skill_names(plugin / "skills")
    for s in sorted(cop_sk - cla_sk):
        errors.append(f"[{name}] skill '{s}' ships Copilot-only (no Claude mirror)")
    for s in sorted(cla_sk - cop_sk):
        errors.append(f"[{name}] skill '{s}' ships Claude-only (no Copilot mirror)")


def main() -> int:
    if not PLUGINS_DIR.is_dir():
        print("no plugins/ directory found", file=sys.stderr)
        return 1

    plugins = sorted(p for p in PLUGINS_DIR.iterdir() if p.is_dir())
    if not plugins:
        print("no plugins found under plugins/", file=sys.stderr)
        return 1

    for plugin in plugins:
        check_plugin(plugin)

    # Root marketplace manifests must also parse.
    check_json(REPO_ROOT / ".github" / "plugin" / "marketplace.json")
    check_json(REPO_ROOT / ".claude-plugin" / "marketplace.json")

    if errors:
        print("Mirror validation FAILED:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1

    print(f"Mirror validation passed: {len(plugins)} plugin(s) in sync.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
