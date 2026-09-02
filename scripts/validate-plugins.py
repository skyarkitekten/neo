#!/usr/bin/env python3
"""Validate every shipped Neo plugin for the GitHub Copilot CLI harness.

Neo ships for a single harness — GitHub Copilot CLI.
Copilot is the canonical, sole source. 

This script makes the remaining invariants executable:

  * every plugin has its Copilot manifest AND hooks config, and both are valid JSON;
  * the root Copilot marketplace manifest is valid JSON;
  * every component path a plugin declares (`agents`, `skills`, `hooks`) resolves to
    something real on disk, AND every component directory that exists is declared.
    Copilot defaults `agents` to `agents/` and `skills` to `skills/` and treats a
    path that resolves to nothing as an empty slot, not an error — the plugin installs
    cleanly and contributes nothing. That is how Neo shipped for several releases with
    skills in `.github/skills/`, no `skills` key, and every skill silently failing to
    load (issue #81);
  * every plugin's hooks.json conforms to the Neo hook-manifest contract
    (scripts/linting/schemas/hook-manifest.schema.json): version 1, known event
    names, well-formed command entries, and the three Neo-specific rules — a
    `powershell` command must not reference the bare `${PLUGIN_ROOT}` placeholder
    (it must use `$env:PLUGIN_ROOT`), no event may be declared in both its
    canonical camelCase and PascalCase-alias form (which would fire it twice), and
    any command invoking a plugin script must first check the script exists.
    preToolUse is fail-closed, so an unresolvable script path — a layout move, a
    stale install — denies every tool call and bricks the session (issue #88);
  * every Copilot agent's `agents:` allowlist references a real agent `name:`;
  * any agent that delegates (non-empty `agents:`) also grants the `agent`/`Task`
    delegation tool in its `tools:` allowlist;
  * every agent's `tools:` allowlist grants at least one tool the Copilot CLI
    actually resolves, and any agent asking for `search`/`web`/`todo`/`github/*`
    — aliases the CLI silently drops — also grants `execute`, the only working
    substitute. Probed against Copilot CLI v1.0.80: `read`, `edit`, `execute`, and
    `agent` resolve; `search`, `web`, `todo`, and `github/*` grant nothing at all.
    An unrecognized tool name is not an error, it is a silent capability loss —
    which is exactly how Neo shipped researchers that could not grep or fetch;
  * no agent uses the `user-invokable:` spelling (VS Code honors only
    `user-invocable:`, so Neo standardizes on the `c` form).

Exit code 0 = all good, 1 = at least one violation. No third-party deps.
"""

from __future__ import annotations

import itertools
import json
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

_LIST_ITEM_RE = re.compile(r"^\s*-\s+")
PLUGINS_DIR = REPO_ROOT / "plugins"

# --- What the Copilot CLI does with `tools:` -------------------------------------
#
# Two tiers of confidence here, deliberately kept apart. PROBED entries were observed
# live against Copilot CLI v1.0.80 by enumerating the runtime tool grant of five
# shipped agents. INFERRED entries are the documented compatible spellings of a probed
# alias (see docs/contributing/guides/agent-authoring-reference.md); they are believed
# to behave the same but were never actually exercised. Re-probe on a CLI upgrade, and
# promote inferred -> probed only with fresh evidence.

# PROBED to resolve: `read` -> `view`, `execute` -> the shell family,
# `agent` -> the task/delegation family, `edit` -> edit tools.
_PROBED_EFFECTIVE = {"read", "edit", "execute", "agent"}
# INFERRED to resolve: documented compatible spellings of the four above.
_INFERRED_EFFECTIVE = {
    "notebookread",
    "multiedit", "write", "notebookedit",
    "shell", "bash", "powershell",
    "custom-agent", "task",
}
CLI_EFFECTIVE_TOOLS = _PROBED_EFFECTIVE | _INFERRED_EFFECTIVE

# PROBED to be silently DROPPED: declaring these grants nothing at all, and an
# unrecognized tool name is not an error, so the loss is invisible. `execute` is the
# only substitute (`rg`/`Select-String` for search, `curl` for web, `gh` for GitHub).
# `github/*` entries are handled separately by prefix.
_PROBED_DROPPED = {"search", "web", "todo"}
# INFERRED dropped: compatible spellings of the three above. Safe to infer in this
# direction — if the primary alias grants nothing, its synonyms will not grant more.
_INFERRED_DROPPED = {"grep", "glob", "websearch", "webfetch", "todowrite"}
CLI_DROPPED_TOOLS = _PROBED_DROPPED | _INFERRED_DROPPED

# Deliberately PROBED-ONLY. `shell`/`bash`/`powershell` are documented synonyms of
# `execute`, but only `execute` was actually confirmed to grant a shell. Accepting the
# unprobed spellings here would let `tools: [read, search, bash]` pass this check while
# granting nothing but `view` — reintroducing the exact bug the check exists to catch.
# Requiring the confirmed spelling fails safe: the worst case is telling an author to
# write `execute`, which is known to work.
EXECUTE_ALIASES = {"execute"}



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
        tail = fm[idx + 1 :]
        # A flow sequence may open on the next line and wrap over several lines.
        if not rest and tail and tail[0].lstrip().startswith("["):
            rest, tail = tail[0].strip(), tail[1:]
        if rest.startswith("["):
            while "]" not in rest and tail:
                rest += " " + tail[0].strip()
                tail = tail[1:]
            inner = rest[1 : rest.rindex("]")] if "]" in rest else rest[1:]
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


# Copilot CLI lifecycle event names, in their canonical camelCase form. Each has a
# PascalCase alias (SessionStart, UserPromptSubmit, Stop, ...) that VS Code reads for
# the SAME event, so declaring both forms fires twice. There is no lowercase
# `userPromptSubmit` and no lowercase `stop` — those are the aliases mis-cased, and a
# hook declared under either name never fires.
HOOK_EVENTS = {
    "sessionStart",
    "sessionEnd",
    "userPromptSubmitted",
    "userPromptTransformed",
    "preToolUse",
    "postToolUse",
    "postToolUseFailure",
    "preCompact",
    "subagentStart",
    "subagentStop",
    "agentStop",
    "errorOccurred",
    "notification",
    "permissionRequest",
}
# Per-platform command keys allowed on a hook entry, plus the cross-platform one.
HOOK_COMMAND_KEYS = {"command", "bash", "powershell", "windows", "linux", "osx"}
HOOK_ENTRY_KEYS = HOOK_COMMAND_KEYS | {"type", "cwd", "env", "timeout", "timeoutSec"}
# ${PLUGIN_ROOT} (and ${...} generally) is PowerShell's own variable syntax and
# expands to an empty string; the env var must be read as $env:PLUGIN_ROOT.
_PS_BAD_PLUGIN_ROOT = re.compile(r"\$\{\s*PLUGIN_ROOT\s*\}")
# A hook command that invokes a plugin script must first check the script is there.
# preToolUse is FAIL-CLOSED: a command that exits non-zero denies the tool call, so an
# unresolvable script path denies *every* tool call and bricks the session (issue #88).
# That is exactly what a layout move or a stale install produces, so the guard is
# required on every event, not just the blocking one.
_PLUGIN_SCRIPT_REF = re.compile(r"PLUGIN_ROOT[^\"']*/hooks/scripts/")
_GUARDS = {
    # command key -> (regex proving the command guards on existence, human hint)
    "bash": (re.compile(r"\[\s*-[fxer]\s"), '[ -f "$s" ] || exit 0'),
    "linux": (re.compile(r"\[\s*-[fxer]\s"), '[ -f "$s" ] || exit 0'),
    "osx": (re.compile(r"\[\s*-[fxer]\s"), '[ -f "$s" ] || exit 0'),
    "powershell": (re.compile(r"Test-Path"), "if (-not (Test-Path -LiteralPath $s)) { exit 0 }"),
    "windows": (re.compile(r"Test-Path"), "if (-not (Test-Path -LiteralPath $s)) { exit 0 }"),
}


def check_hooks_manifest(path: Path) -> None:
    """Validate a plugin hooks.json against the Neo hook-manifest contract.

    Enforces the schema's structural invariants plus three Neo-specific rules that
    a plain JSON parse can't catch: no bare ${PLUGIN_ROOT} inside a `powershell`
    command, no event declared in both CLI-lowercase and PascalCase form, and no
    unguarded invocation of a plugin script.
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
    command = entry.get("command")
    if isinstance(command, str) and _PLUGIN_SCRIPT_REF.search(command):
        err(
            f"{where}: `command` invokes a plugin script, but one portable command cannot "
            f"guard its existence in both POSIX shells and PowerShell — use guarded `bash` "
            f"and `powershell` commands instead"
        )
    for key, (guard, hint) in _GUARDS.items():
        cmd = entry.get(key)
        if not isinstance(cmd, str):
            continue
        if _PLUGIN_SCRIPT_REF.search(cmd) and not guard.search(cmd):
            err(
                f"{where}: `{key}` command invokes a plugin script without checking it "
                f"exists — a missing script exits non-zero, and preToolUse is fail-closed, "
                f"so every tool call gets denied. Guard it: {hint}"
            )


def copilot_agent_files(plugin: Path) -> list[Path]:
    d = plugin / "agents"
    return sorted(d.glob("neo.*.agent.md")) if d.is_dir() else []


def check_cli_tools(plugin_name: str, agent_file: Path, lowered: set[str]) -> None:
    """A `tools:` allowlist must grant capability the Copilot CLI actually resolves.

    Two failures, both of which ship a silently crippled agent:

      1. Nothing in the list resolves, so the agent runs with the bare default grant.
         This is how `neo.implementation-planner` (`tools: ["search"]`) ended up able
         to read a file but not search for one.
      2. The list asks for a dropped alias (`search`, `web`, `todo`, `github/*`) without
         `execute`. The agent's prompt then tells it to search or fetch with no tool that
         can — which is how researchers ended up answering from recall and citing sources
         they never opened.
    """
    if not lowered or "*" in lowered:
        return  # `[]` = deliberately toolless; `["*"]` = everything

    if not lowered & CLI_EFFECTIVE_TOOLS:
        errors.append(
            f"[{plugin_name}] {agent_file.name} declares tools: {sorted(lowered)}, none of which "
            f"the Copilot CLI resolves; the agent gets no capability from this list. Grant at "
            f"least one of {sorted(CLI_EFFECTIVE_TOOLS)}"
        )
        return

    dropped = sorted((lowered & CLI_DROPPED_TOOLS) | {t for t in lowered if t.split("/", 1)[0] == "github"})
    if dropped and not lowered & EXECUTE_ALIASES:
        errors.append(
            f"[{plugin_name}] {agent_file.name} declares {dropped}, which the Copilot CLI "
            f"silently ignores, but does not declare `execute` - the only confirmed substitute "
            f"(rg/Select-String, curl, gh). The agent will be unable to search, fetch, or "
            f"reach GitHub despite its prompt telling it to"
        )


def check_component_paths(plugin: Path) -> None:
    """Every component the plugin ships must be declared AND resolve on disk.

    Copilot CLI defaults `agents` to `agents/` and `skills` to `skills/` relative to
    the plugin root. A component that lives elsewhere with no manifest key pointing at
    it is not an error to the CLI — the plugin installs cleanly and contributes nothing
    from that slot. That is exactly how Neo shipped for several releases with every
    skill silently failing to load (issue #81).

    So we check both directions:
      1. A declared path must exist. A typo'd or stale path ships an empty slot.
      2. A component directory that exists must be declared. Relying on the implicit
         default is what made the original bug invisible in review.
    """
    name = plugin.name
    manifest = plugin / "plugin.json"
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
    except Exception:
        return  # check_json already reported it

    def declared(key: str) -> list[str]:
        v = data.get(key)
        if v is None:
            return []
        return [v] if isinstance(v, str) else [x for x in v if isinstance(x, str)]

    # 1. Declared paths must resolve — and must stay inside the plugin.
    for key, want_dir in (("agents", True), ("skills", True), ("hooks", False)):
        for rel in declared(key):
            # A plugin is copied standalone on install, so a path that escapes the plugin
            # root (absolute, or via ..) resolves during validation against this checkout
            # but is simply absent once installed. Note pathlib discards the base entirely
            # when `rel` is absolute, so `plugin / "/etc"` is `/etc`.
            target = plugin / rel
            try:
                inside = target.resolve().is_relative_to(plugin.resolve())
            except OSError:
                inside = False
            if not inside:
                errors.append(
                    f"[{name}] plugin.json declares {key}: '{rel}', which resolves outside "
                    f"plugins/{name}/. A plugin is installed standalone, so anything beyond "
                    f"its own directory is not packaged and will be missing at runtime"
                )
                continue

            ok = target.is_dir() if want_dir else target.is_file()
            if not ok:
                kind = "directory" if want_dir else "file"
                errors.append(
                    f"[{name}] plugin.json declares {key}: '{rel}', which is not a "
                    f"{kind} under plugins/{name}/. Copilot loads the plugin anyway and "
                    f"contributes nothing from this slot"
                )
            elif want_dir and not any(target.iterdir()):
                errors.append(
                    f"[{name}] plugin.json declares {key}: '{rel}', which is an empty "
                    f"directory"
                )

    # 2. Components that exist must be declared. `hooks` is included because it has no
    #    CLI default in the manifest schema — an undeclared hooks file may contribute
    #    nothing, and the published docs are self-contradictory about whether
    #    hooks/hooks.json is auto-discovered. Declaring it removes the question.
    for key, probe in (("agents", "agents"), ("skills", "skills"), ("hooks", "hooks/hooks.json")):
        target = plugin / probe
        exists = target.is_file() if key == "hooks" else target.is_dir()
        if exists and not declared(key):
            errors.append(
                f"[{name}] plugins/{name}/{probe} exists but plugin.json declares no "
                f"'{key}' key. Declare it explicitly ('{probe}') even where it matches "
                f"the CLI default, so the path is visible in review"
            )

    skills_dir = plugin / "skills"
    if skills_dir.is_dir():
        # Copilot loads a skill from a child directory containing SKILL.md. A skills/ dir
        # holding only loose files (a README, say) passes the non-empty check above while
        # contributing nothing, so require at least one real skill directory.
        if not any(d.is_dir() for d in skills_dir.iterdir()):
            errors.append(
                f"[{name}] plugins/{name}/skills/ contains no skill directories; Copilot "
                f"will load zero skills from it"
            )
        for d in sorted(skills_dir.iterdir()):
            if d.is_dir() and not (d / "SKILL.md").is_file():
                errors.append(f"[{name}] skills/{d.name}/ has no SKILL.md; it will not load")

    # A bash hook script that isn't executable dies with "Permission denied" at runtime.
    # This shipped too: neo-product's .sh scripts were committed 100644, so every one of
    # its hooks failed silently while neo-core's identical siblings worked.
    for sh in sorted((plugin / "hooks" / "scripts").glob("*.sh")):
        if not os.access(sh, os.X_OK):
            errors.append(
                f"[{name}] hooks/scripts/{sh.name} is not executable; every hook that "
                f"invokes it fails with 'Permission denied'. chmod +x it and commit the "
                f"mode (git update-index --chmod=+x)"
            )

    if (plugin / ".github").exists():
        errors.append(
            f"[{name}] plugins/{name}/.github/ exists. A plugin install directory is not a "
            f"repository root, so .github/ is not a component location — put plugin.json, "
            f"agents/, skills/, and hooks/ at the plugin root"
        )


def check_plugin(plugin: Path) -> None:
    name = plugin.name

    # 1. Copilot manifest + hooks config must exist and parse.
    check_json(plugin / "plugin.json")
    hooks_json = plugin / "hooks" / "hooks.json"
    check_json(hooks_json)
    check_hooks_manifest(hooks_json)

    # 1b. Declared component paths must match what's actually on disk, in both
    #     directions — an undeclared or unresolvable path fails silently at runtime.
    check_component_paths(plugin)

    # 2. Every Copilot agent's `agents:` allowlist must reference a real name:.
    #    Copilot resolves delegated agents by their `name:` field, not filename,
    #    so a name/allowlist mismatch silently breaks delegation.
    files = copilot_agent_files(plugin)
    if not files:
        errors.append(f"[{name}] no Copilot agents found under agents/")
        return
    declared = {fm_name(f) for f in files} - {None}
    # Aliases that grant the sub-agent delegation ("Task") tool, case-insensitive.
    DELEGATION_TOOLS = {"agent", "custom-agent", "task"}
    for f in files:
        if any(ln.startswith("user-invokable:") for ln in frontmatter_lines(f)):
            errors.append(
                f"[{name}] {f.name} uses `user-invokable:`; Neo standardizes on "
                f"`user-invocable:`, the only spelling VS Code honors"
            )

        # 3. `tools:` must grant capability the CLI actually resolves.
        tools = fm_tools(f)
        lowered = {t.strip().lower() for t in tools} if tools is not None else None
        if lowered is not None:
            check_cli_tools(name, f, lowered)

        refs = fm_agents(f)
        if not refs:
            continue
        for ref in refs:
            if ref not in declared:
                errors.append(
                    f"[{name}] {f.name} lists agent '{ref}' in its agents: allowlist, "
                    f"but no Copilot agent declares name: '{ref}'"
                )
        # 4. An agent that delegates must also be granted the delegation tool.
        #    `tools:` is an allowlist: if set and it omits the `agent`/`Task` alias
        #    (and isn't the `*` wildcard), delegation silently has no task tool.
        if lowered is None:
            continue  # unset => all tools allowed, delegation works
        if "*" in lowered or lowered & DELEGATION_TOOLS:
            continue
        errors.append(
            f"[{name}] {f.name} declares a non-empty agents: allowlist but its tools: "
            f"list omits the delegation tool (one of {sorted(DELEGATION_TOOLS)}); "
            f"sub-agents cannot be invoked without it"
        )


def check_marketplace(path: Path) -> None:
    """Each plugins[] entry must resolve and agree with that plugin's own plugin.json version."""
    try:
        entries = json.loads(path.read_text()).get("plugins", [])
    except (FileNotFoundError, json.JSONDecodeError):
        return  # check_json already reported it

    for entry in entries:
        name = entry.get("name", "<unnamed>")
        source = entry.get("source")
        if not source:
            errors.append(f"[marketplace] {name} has no source")
            continue
        manifest = REPO_ROOT / source / "plugin.json"
        if not manifest.is_file():
            errors.append(f"[marketplace] {name} source '{source}' has no plugin.json")
            continue
        plugin_data = json.loads(manifest.read_text())
        declared = plugin_data.get("version")
        if entry.get("version") != declared:
            errors.append(
                f"[marketplace] {name} version '{entry.get('version')}' disagrees with "
                f"{source}/plugin.json version '{declared}'"
            )
        # Component paths in a marketplace entry are inert when the source ships its own
        # plugin.json — the CLI reads the plugin's manifest, not this one. Verified against
        # CLI 1.0.81: an entry that was the sole declarant loaded zero skills, and one that
        # declared an outright false path still loaded correctly. Keeping a copy here means
        # maintaining a value nothing reads, which reads as live config to the next person.
        for key in ("agents", "skills", "hooks"):
            if key in entry:
                errors.append(
                    f"[marketplace] {name} declares {key}: {entry[key]!r}, which the CLI "
                    f"ignores because {source}/plugin.json is authoritative for component "
                    f"paths. Remove it — a copy here is dead config that looks live"
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
    marketplace = REPO_ROOT / ".github" / "plugin" / "marketplace.json"
    check_json(marketplace)
    check_marketplace(marketplace)

    if errors:
        print("Plugin validation FAILED:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1

    print(f"Plugin validation passed: {len(plugins)} plugin(s) OK.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
