#!/usr/bin/env python3
"""Summarize agent hook logs (events.jsonl) into per-agent and per-run stats.

Reads the JSONL produced by log-event.sh and reports the things you tune on:
  - per agent: event count, tool-call count, top tools, approx active time
  - per run:   wall-clock duration, worker completions, review->fix rounds
  - global:    runs, events, parse-error rate, agents seen

Usage:
  python analyze_agent_logs.py [PATH]              # default: ~/.agent-logs/events.jsonl
  python analyze_agent_logs.py PATH --run BRANCH   # only one run/correlation id
  python analyze_agent_logs.py PATH --json         # machine-readable output

Notes / caveats:
  * Agent attribution depends on the harness putting an agent name in the payload.
    If most records have no agent, the script says so and falls back to event stats.
  * "review rounds" is a heuristic: the number of code-reviewer completions in a run.
    More than one means the write->review->fix loop ran multiple times.
  * Durations use 1-second-resolution timestamps, so treat them as approximate.
"""

import argparse
import json
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime

STOP_EVENTS = {"SubagentStop", "agentStop", "Stop"}
TOOL_EVENTS = {"PostToolUse", "postToolUse"}
UNATTRIBUTED = "(unattributed)"
REVIEWER_NAMES = {"code-reviewer", "reviewer"}
WRITER_NAMES = {"code-writer", "writer"}


def parse_ts(s):
    if not isinstance(s, str):
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return None


def load(path):
    recs, errors = [], 0
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                recs.append(json.loads(line))
            except json.JSONDecodeError:
                errors += 1
    return recs, errors


def span_seconds(records):
    ts = [parse_ts(r.get("ts")) for r in records]
    ts = [t for t in ts if t]
    if len(ts) < 2:
        return 0
    return int((max(ts) - min(ts)).total_seconds())


def fmt_secs(s):
    if s < 60:
        return f"{s}s"
    m, s = divmod(s, 60)
    if m < 60:
        return f"{m}m{s:02d}s"
    h, m = divmod(m, 60)
    return f"{h}h{m:02d}m"


def summarize(recs):
    runs = defaultdict(list)
    for r in recs:
        runs[r.get("run") or "unknown"].append(r)

    agents = defaultdict(list)
    for r in recs:
        agents[r.get("agent") or UNATTRIBUTED].append(r)

    parse_errors = sum(1 for r in recs if r.get("parse_error"))

    run_stats = {}
    for run, rs in runs.items():
        tool_calls = sum(1 for r in rs if r.get("event") in TOOL_EVENTS)
        stops = Counter(
            r.get("agent") or UNATTRIBUTED
            for r in rs
            if r.get("event") in STOP_EVENTS
        )
        review_rounds = sum(v for k, v in stops.items() if k in REVIEWER_NAMES)
        writer_runs = sum(v for k, v in stops.items() if k in WRITER_NAMES)
        run_stats[run] = {
            "events": len(rs),
            "duration_s": span_seconds(rs),
            "tool_calls": tool_calls,
            "worker_completions": dict(stops),
            "review_rounds": review_rounds,
            "writer_runs": writer_runs,
        }

    agent_stats = {}
    for agent, rs in agents.items():
        tools = Counter(
            r.get("tool") for r in rs
            if r.get("event") in TOOL_EVENTS and r.get("tool")
        )
        agent_stats[agent] = {
            "events": len(rs),
            "tool_calls": sum(tools.values()),
            "top_tools": tools.most_common(5),
            "active_s": span_seconds(rs),
        }

    return {
        "global": {
            "runs": len(runs),
            "events": len(recs),
            "parse_errors": parse_errors,
            "agents": sorted(agents.keys()),
            "attribution_ok": (agents.get(UNATTRIBUTED, []) and len(agents[UNATTRIBUTED]) < len(recs) / 2)
            or UNATTRIBUTED not in agents,
        },
        "runs": run_stats,
        "agents": agent_stats,
    }


def print_report(s):
    g = s["global"]
    print("== GLOBAL ==")
    print(f"runs: {g['runs']}   events: {g['events']}   parse_errors: {g['parse_errors']}")
    print(f"agents seen: {', '.join(g['agents']) or '(none)'}")
    if not g["attribution_ok"]:
        print("!! Most records have no agent name — agent stats are unreliable.")
        print("   Confirm the harness includes an agent field, or set AGENT_RUN_ID per agent.")

    print("\n== PER AGENT ==")
    for agent, a in sorted(s["agents"].items(), key=lambda kv: -kv[1]["events"]):
        tops = ", ".join(f"{t}×{n}" for t, n in a["top_tools"]) or "-"
        print(f"{agent:<18} events={a['events']:<5} tool_calls={a['tool_calls']:<5} "
              f"active={fmt_secs(a['active_s']):<8} top_tools=[{tops}]")

    print("\n== PER RUN ==")
    for run, r in sorted(s["runs"].items(), key=lambda kv: -kv[1]["duration_s"]):
        comps = ", ".join(f"{k}={v}" for k, v in r["worker_completions"].items()) or "-"
        flag = "  <-- multiple review rounds" if r["review_rounds"] > 1 else ""
        print(f"[{run}] dur={fmt_secs(r['duration_s']):<8} events={r['events']:<5} "
              f"tools={r['tool_calls']:<5} review_rounds={r['review_rounds']}{flag}")
        print(f"    completions: {comps}")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    default = os.path.expanduser("~/.agent-logs/events.jsonl")
    ap.add_argument("path", nargs="?", default=default, help=f"JSONL log (default: {default})")
    ap.add_argument("--run", help="filter to a single run/correlation id")
    ap.add_argument("--json", action="store_true", help="emit JSON instead of a text report")
    args = ap.parse_args()

    if not os.path.exists(args.path):
        sys.exit(f"log not found: {args.path}")

    recs, read_errors = load(args.path)
    if args.run:
        recs = [r for r in recs if (r.get("run") or "unknown") == args.run]
    if not recs:
        sys.exit("no records to analyze")

    stats = summarize(recs)
    stats["global"]["unreadable_lines"] = read_errors

    if args.json:
        print(json.dumps(stats, indent=2, default=str))
    else:
        print_report(stats)


if __name__ == "__main__":
    main()
