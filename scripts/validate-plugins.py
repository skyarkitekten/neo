#!/usr/bin/env python3
"""Validate every shipped neo plugin for the GitHub Copilot CLI harness.

Neo ships for a single harness — GitHub Copilot CLI.
Copilot is the canonical, sole source. 

This script makes the remaining invariants executable:

  * every plugin has its Copilot manifest AND hooks config, and both are valid JSON;
  * the root Copilot marketplace manifest is valid JSON;
  * every plugin's hooks.json conforms to the neo hook-manifest contract
    (scripts/linting/schemas/hook-manifest.schema.json): version 1, known event
    names, well-formed command entries, and the two neo-specific rules — a
    `powershell` command must not reference the bare `${PLUGIN_ROOT}` placeholder
    (it must use `$env:PLUGIN_ROOT`), and no event may be declared in both its
    CLI-lowercase and PascalCase form (which would fire it twice);
  * every Copilot agent's `agents:` allowlist references a real agent `name:`;
  * any agent that delegates (non-empty `agents:`) also grants the `agent`/`Task`
    delegation tool in its `tools:` allowlist.

Exit code 0 = all good, 1 = at least one violation. No third-party deps.
"""

from __future__ import annotations

import itertools
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

_LIST_ITEM_RE = re.compile(r"^\s*-\s+")
PLUGINS_DIR = REPO_ROOT / "plugins"

errors: list[str] = []


def frontmatter_lines(path: Path) -> list[str]:
    """Return the raw lines between the opening and closing `---` fences."""
    text = path.read_text()
    if not text.startswith("---"):
        return []
    lines = text.splitlines()
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            return lines[1:i]
    return []


def _unquote(s: str) -> str:
    return s.strip().strip("'\"").strip()


def fm_name(path: Path) -> str | None:
    for ln in frontmatter_lines(path):
        if ln.startswith("name:"):
            return _unquote(ln[len("name:") :])
    return None


def _fm_list(path: Path, key: str) -> list[str] | None:
    """Parse a frontmatter list field `key` (inline `[a, b]`, comma string, or block `- a`).

    Returns None when the file declares no `key:` at all, so a missing field is
    distinguishable from an empty one.
    """
    fm = frontmatter_lines(path)
    prefix = f"{key}:"
    for idx, ln in enumerate(fm):
        if not ln.startswith(prefix):
            continue
        rest = ln[len(prefix) :].strip()
        if rest.startswith("["):
            inner = rest[rest.index("[") + 1 : rest.rindex("]")] if "]" in rest else rest[1:]
            return [_unquote(x) for x in inner.split(",") if x.strip()]
        if rest:  # single scalar or comma-separated string value
            return [_unquote(x) for x in rest.split(",") if x.strip()]
        # Block list on following indented `- item` lines. Take lines while they're
        # still part of the block (a list item, blank, or indented continuation),
        # stopping at the next unindented, non-list line (a new top-level key).
        block = itertools.takewhile(
            lambda ln2: bool(_LIST_ITEM_RE.match(ln2)) or not ln2.strip() or ln2.startswith((" ", "\t")),
            fm[idx + 1 :],
        )
        return [_unquote(_LIST_ITEM_RE.sub("", ln2)) for ln2 in block if _LIST_ITEM_RE.match(ln2)]
    return None


def fm_agents(path: Path) -> list[str] | None:
    """Parse an agent's `agents:` allowlist (inline `[a, b]` or block `- a`).

    Returns None when the file declares no `agents:` key at all, so a missing
    allowlist is distinguishable from an empty one.
    """
    return _fm_list(path, "agents")


def fm_tools(path: Path) -> list[str] | None:
    """Parse an agent's `tools:` allowlist. None means unset (all tools allowed)."""
    return _fm_list(path, "tools")


def check_json(path: Path) -> None:
    try:
        json.loads(path.read_text())
    except FileNotFoundError:
        errors.append(f"missing manifest: {path.relative_to(REPO_ROOT)}")
    except json.JSONDecodeError as exc:
        errors.append(f"invalid JSON: {path.relative_to(REPO_ROOT)} — {exc}")


# Copilot CLI lifecycle event names, in their canonical camelCase form. VS Code
# converts each to PascalCase at load time, so declaring both forms fires twice.
HOOK_EVENTS = {
    "sessionStart",
    "sessionEnd",
    "userPromptSubmit",
    "userPromptSubmitted",
    "preToolUse",
    "postToolUse",
    "preCompact",
    "subagentStart",
    "subagentStop",
    "stop",
    "agentStop",
    "errorOccurred",
}
# Per-platform command keys allowed on a hook entry, plus the cross-platform one.
HOOK_COMMAND_KEYS = {"command", "bash", "powershell", "windows", "linux", "osx"}
HOOK_ENTRY_KEYS = HOOK_COMMAND_KEYS | {"type", "cwd", "env", "timeout", "timeoutSec"}
# ${PLUGIN_ROOT} (and ${...} generally) is PowerShell's own variable syntax and
# expands to an empty string; the env var must be read as $env:PLUGIN_ROOT.
_PS_BAD_PLUGIN_ROOT = re.compile(r"\$\{\s*PLUGIN_ROOT\s*\}")


def check_hooks_manifest(path: Path) -> None:
    """Validate a plugin hooks.json against the neo hook-manifest contract.

    Enforces the schema's structural invariants plus two neo-specific rules that
    a plain JSON parse can't catch: no bare ${PLUGIN_ROOT} inside a `powershell`
    command, and no event declared in both CLI-lowercase and PascalCase form.
    """
    rel = path.relative_to(REPO_ROOT)
    try:
        data = json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return  # already reported by check_json

    def err(msg: str) -> None:
        errors.append(f"[hooks] {rel}: {msg}")

    if not isinstance(data, dict):
        err("manifest must be a JSON object")
        return
    extra = set(data) - {"version", "description", "hooks"}
    if extra:
        err(f"unknown top-level key(s): {sorted(extra)}")
    if data.get("version") != 1:
        err(f"version must be 1, got {data.get('version')!r}")
    hooks = data.get("hooks")
    if not isinstance(hooks, dict) or not hooks:
        err("`hooks` must be a non-empty object")
        return

    # Detect events declared in both camelCase and PascalCase (double-fire).
    seen_lower: dict[str, str] = {}
    for event, entries in hooks.items():
        low = event[:1].lower() + event[1:] if event else event
        if low in seen_lower and seen_lower[low] != event:
            err(f"event '{event}' duplicates '{seen_lower[low]}' (would fire twice)")
        seen_lower[low] = event
        if low not in HOOK_EVENTS:
            err(f"unknown event name '{event}'")
        if not isinstance(entries, list) or not entries:
            err(f"event '{event}' must map to a non-empty array")
            continue
        for i, entry in enumerate(entries):
            _check_hook_entry(entry, f"{event}[{i}]", err)


def _check_hook_entry(entry: object, where: str, err) -> None:
    if not isinstance(entry, dict):
        err(f"{where}: entry must be an object")
        return
    unknown = set(entry) - HOOK_ENTRY_KEYS
    if unknown:
        err(f"{where}: unknown key(s) {sorted(unknown)}")
    if entry.get("type") != "command":
        err(f"{where}: type must be \"command\"")
    if not (set(entry) & HOOK_COMMAND_KEYS):
        err(f"{where}: needs at least one command key {sorted(HOOK_COMMAND_KEYS)}")
    ps = entry.get("powershell")
    if isinstance(ps, str) and _PS_BAD_PLUGIN_ROOT.search(ps):
        err(
            f"{where}: powershell command uses bare ${{PLUGIN_ROOT}}, which PowerShell "
            f"expands to empty — use $env:PLUGIN_ROOT instead"
        )


def copilot_agent_files(plugin: Path) -> list[Path]:
    d = plugin / ".github" / "agents"
    return sorted(d.glob("neo.*.agent.md")) if d.is_dir() else []


def check_plugin(plugin: Path) -> None:
    name = plugin.name

    # 1. Copilot manifest + hooks config must exist and parse.
    check_json(plugin / ".github" / "plugin" / "plugin.json")
    hooks_json = plugin / ".github" / "hooks" / "hooks.json"
    check_json(hooks_json)
    check_hooks_manifest(hooks_json)

    # 2. Every Copilot agent's `agents:` allowlist must reference a real name:.
    #    Copilot resolves delegated agents by their `name:` field, not filename,
    #    so a name/allowlist mismatch silently breaks delegation.
    files = copilot_agent_files(plugin)
    if not files:
        errors.append(f"[{name}] no Copilot agents found under .github/agents/")
        return
    declared = {fm_name(f) for f in files} - {None}
    # Aliases that grant the sub-agent delegation ("Task") tool, case-insensitive.
    DELEGATION_TOOLS = {"agent", "custom-agent", "task"}
    for f in files:
        refs = fm_agents(f)
        if not refs:
            continue
        for ref in refs:
            if ref not in declared:
                errors.append(
                    f"[{name}] {f.name} lists agent '{ref}' in its agents: allowlist, "
                    f"but no Copilot agent declares name: '{ref}'"
                )
        # 3. An agent that delegates must also be granted the delegation tool.
        #    `tools:` is an allowlist: if set and it omits the `agent`/`Task` alias
        #    (and isn't the `*` wildcard), delegation silently has no task tool.
        tools = fm_tools(f)
        if tools is None:
            continue  # unset => all tools allowed, delegation works
        lowered = {t.lower() for t in tools}
        if "*" in lowered or lowered & DELEGATION_TOOLS:
            continue
        errors.append(
            f"[{name}] {f.name} declares a non-empty agents: allowlist but its tools: "
            f"list omits the delegation tool (one of {sorted(DELEGATION_TOOLS)}); "
            f"sub-agents cannot be invoked without it"
        )


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

    # Root Copilot marketplace manifest must also parse.
    check_json(REPO_ROOT / ".github" / "plugin" / "marketplace.json")

    if errors:
        print("Plugin validation FAILED:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1

    print(f"Plugin validation passed: {len(plugins)} plugin(s) OK.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
