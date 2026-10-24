#!/usr/bin/env bash
# git-cleanup.sh — report (and optionally remove) dead local branches and worktrees.
# Dry run by default. Compatible with the bash 3.2 that ships with macOS.
set -eo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/git-cleanup.sh [options]

Reports dead local branches and removable worktrees. Changes nothing unless --apply.

Options:
  -a, --apply            Remove what the report marks as removable (prompts first)
  -y, --yes              Don't prompt when applying
  -b, --base <ref>       Ref to test merges against (default: origin/HEAD, else main)
  -s, --stale-days <n>   Flag unmerged branches with no commits in n days (default: 30)
  -f, --force            Also delete "gone" branches whose changes aren't in base, and
                         remove dirty worktrees (DISCARDS uncommitted changes)
      --detached         Also remove clean detached-HEAD worktrees whose HEAD is in base
      --no-fetch         Skip `git fetch --prune`
  -h, --help             Show this help

Branch categories:
  merged    tip is an ancestor of base                            removable
  squashed  changes already in base (squash or rebase merge)      removable
  gone      upstream deleted, changes not found in base           removable with --force
  stale     unmerged, no commits in --stale-days                  report only

Never touched: the base branch, the current branch, the main worktree, the current
worktree, locked worktrees, and branches checked out in a worktree that is kept.
EOF
}

APPLY=0 YES=0 FORCE=0 DETACHED=0 FETCH=1 STALE_DAYS=30 BASE=""
while [ $# -gt 0 ]; do
  case "$1" in
    -a|--apply) APPLY=1 ;;
    -y|--yes) YES=1 ;;
    -f|--force) FORCE=1 ;;
    --detached) DETACHED=1 ;;
    --no-fetch) FETCH=0 ;;
    -b|--base) BASE="${2:?--base needs a value}"; shift ;;
    -s|--stale-days) STALE_DAYS="${2:?--stale-days needs a value}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

if [ -t 1 ]; then
  BOLD=$'\033[1m' DIM=$'\033[2m' RED=$'\033[31m' GRN=$'\033[32m' YEL=$'\033[33m' RST=$'\033[0m'
else
  BOLD="" DIM="" RED="" GRN="" YEL="" RST=""
fi
die()  { echo "${RED}error:${RST} $*" >&2; exit 1; }
warn() { echo "${YEL}warn:${RST} $*" >&2; }
tildify() { case "$1" in "$HOME"/*) echo "~${1#"$HOME"}" ;; *) echo "$1" ;; esac; }
realdir() { (cd "$1" 2>/dev/null && pwd -P) || echo "$1"; }

git rev-parse --git-dir >/dev/null 2>&1 || die "not inside a git repository"

if [ "$FETCH" = 1 ]; then
  git fetch --all --prune --quiet 2>/dev/null || warn "git fetch --prune failed; using local refs"
fi

if [ -z "$BASE" ]; then
  BASE=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)
  if [ -z "$BASE" ]; then
    for c in origin/main origin/master main master; do
      if git rev-parse --verify --quiet "$c^{commit}" >/dev/null; then BASE=$c; break; fi
    done
  fi
fi
[ -n "$BASE" ] && git rev-parse --verify --quiet "$BASE^{commit}" >/dev/null \
  || die "can't resolve base ref '${BASE:-<none>}'; pass --base"
BASE_LOCAL=${BASE#*/}
[ "$BASE_LOCAL" = "$BASE" ] || git show-ref --verify --quiet "refs/remotes/$BASE" || BASE_LOCAL=$BASE

CURRENT_BRANCH=$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)
CURRENT_WT=$(realdir "$(git rev-parse --show-toplevel)")
NOW=$(date +%s)
STALE_SECS=$((STALE_DAYS * 86400))

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
WT="$TMP/worktrees"        # path \t branch|- \t head \t locked \t prunable
RM_WT="$TMP/rm-worktrees"  # path \t reason \t force(0|1)
RM_BR="$TMP/rm-branches"   # branch \t category \t age \t subject
KEEP="$TMP/keep"           # category \t branch \t age \t note
: >"$RM_WT"; : >"$RM_BR"; : >"$KEEP"

git worktree list --porcelain | awk '
  function flush() { if (p != "") printf "%s\t%s\t%s\t%d\t%d\n", p, (b == "" ? "-" : b), h, l, r }
  /^worktree / { flush(); p = substr($0, 10); b = ""; h = ""; l = 0; r = 0; next }
  /^HEAD /     { h = $2 }
  /^branch /   { b = substr($0, 8); sub("^refs/heads/", "", b) }
  /^locked/    { l = 1 }
  /^bare/      { l = 1 }
  /^prunable/  { r = 1 }
  END { flush() }' >"$WT"
MAIN_WT=$(realdir "$(head -n1 "$WT" | cut -f1)")

is_dirty() { [ -n "$(git -C "$1" status --porcelain 2>/dev/null)" ]; }

# Squash/rebase-merge detection: collapse the branch into one commit on its merge-base
# and ask `git cherry` whether an equivalent patch already exists in base.
is_squashed() {
  local mb tmp
  mb=$(git merge-base "$BASE" "$1" 2>/dev/null) || return 1
  tmp=$(git commit-tree "$(git rev-parse "$1^{tree}")" -p "$mb" -m _) || return 1
  case "$(git cherry "$BASE" "$tmp")" in -*) return 0 ;; esac
  return 1
}

# Decide whether a dead branch's worktree can go. Prints a reason to keep it, or nothing.
worktree_blocker() {
  local path=$1 locked=$2 real
  real=$(realdir "$path")
  [ "$real" = "$MAIN_WT" ] && { echo "main worktree"; return; }
  [ "$real" = "$CURRENT_WT" ] && { echo "current worktree"; return; }
  [ "$locked" = 1 ] && { echo "worktree locked"; return; }
  if [ -d "$path" ] && is_dirty "$path" && [ "$FORCE" = 0 ]; then echo "worktree dirty"; fi
}

while IFS=$'\t' read -r br ts age track; do
  [ "$br" = "$BASE_LOCAL" ] || [ "$br" = "$CURRENT_BRANCH" ] && continue
  subject=$(git log -1 --format=%s "refs/heads/$br")

  cat=""
  if git merge-base --is-ancestor "refs/heads/$br" "$BASE"; then cat=merged
  elif is_squashed "refs/heads/$br"; then cat=squashed
  elif [ "$track" = "[gone]" ]; then cat=gone
  elif [ $((NOW - ts)) -gt "$STALE_SECS" ]; then cat=stale
  fi
  [ -z "$cat" ] && continue

  removable=0
  case "$cat" in merged|squashed) removable=1 ;; gone) [ "$FORCE" = 1 ] && removable=1 ;; esac
  if [ "$removable" = 0 ]; then
    note="review manually"; [ "$cat" = gone ] && note="unmerged work; --force to delete"
    printf '%s\t%s\t%s\t%s\n' "$cat" "$br" "$age" "$note" >>"$KEEP"
    continue
  fi

  wt_line=$(awk -F'\t' -v b="$br" '$2 == b' "$WT" | head -n1)
  if [ -n "$wt_line" ]; then
    wt_path=$(printf '%s' "$wt_line" | cut -f1)
    wt_locked=$(printf '%s' "$wt_line" | cut -f4)
    blocker=$(worktree_blocker "$wt_path" "$wt_locked")
    if [ -n "$blocker" ]; then
      printf '%s\t%s\t%s\t%s\n' "$cat" "$br" "$age" "$blocker: $(tildify "$wt_path")" >>"$KEEP"
      continue
    fi
    dirty=0; [ -d "$wt_path" ] && is_dirty "$wt_path" && dirty=1
    printf '%s\t%s\t%s\n' "$wt_path" "branch $br is $cat$([ $dirty = 1 ] && echo ', DIRTY')" "$dirty" >>"$RM_WT"
  fi
  printf '%s\t%s\t%s\t%s\n' "$br" "$cat" "$age" "$subject" >>"$RM_BR"
done < <(git for-each-ref refs/heads \
  --format='%(refname:short)%09%(committerdate:unix)%09%(committerdate:relative)%09%(upstream:track)')

PRUNABLE=$(awk -F'\t' '$5 == 1' "$WT" | wc -l | tr -d ' ')

while IFS=$'\t' read -r path br head locked prunable; do
  [ "$br" = "-" ] && [ "$prunable" = 0 ] || continue
  [ -n "$(worktree_blocker "$path" "$locked")" ] && continue
  if is_dirty "$path"; then
    printf '%s\t%s\t%s\t%s\n' detached "-" "-" "dirty detached worktree: $(tildify "$path")" >>"$KEEP"
  elif git merge-base --is-ancestor "$head" "$BASE" 2>/dev/null; then
    if [ "$DETACHED" = 1 ]; then
      printf '%s\t%s\t%s\n' "$path" "detached at ${head:0:7}, already in $BASE" 0 >>"$RM_WT"
    else
      printf '%s\t%s\t%s\t%s\n' detached "-" "-" "clean, in $BASE (--detached to remove): $(tildify "$path")" >>"$KEEP"
    fi
  fi
done <"$WT"

# ---------- report ----------
echo "${BOLD}Base:${RST} $BASE   ${BOLD}Current:${RST} ${CURRENT_BRANCH:-(detached)}   ${DIM}stale > ${STALE_DAYS}d${RST}"
echo

n_br=$(wc -l <"$RM_BR" | tr -d ' ')
n_wt=$(wc -l <"$RM_WT" | tr -d ' ')
n_keep=$(wc -l <"$KEEP" | tr -d ' ')

echo "${BOLD}${RED}Removable branches ($n_br)${RST}"
if [ "$n_br" = 0 ]; then echo "  ${DIM}none${RST}"; else
  while IFS=$'\t' read -r br cat age subject; do
    printf '  %-9s %-45s %-16s %s\n' "$cat" "$br" "$age" "${DIM}${subject:0:60}${RST}"
  done <"$RM_BR"
fi
echo

echo "${BOLD}${RED}Removable worktrees ($n_wt)${RST}"
if [ "$n_wt" = 0 ]; then echo "  ${DIM}none${RST}"; else
  while IFS=$'\t' read -r path reason _; do
    printf '  %-70s %s\n' "$(tildify "$path")" "${DIM}${reason}${RST}"
  done <"$RM_WT"
fi
[ "$PRUNABLE" != 0 ] && echo "  + $PRUNABLE stale worktree record(s) with missing directories (git worktree prune)"
echo

echo "${BOLD}${YEL}Needs a look ($n_keep)${RST}"
if [ "$n_keep" = 0 ]; then echo "  ${DIM}none${RST}"; else
  sort "$KEEP" | while IFS=$'\t' read -r cat br age note; do
    printf '  %-9s %-45s %-16s %s\n' "$cat" "$br" "$age" "${DIM}${note}${RST}"
  done
fi
echo

if [ "$APPLY" = 0 ]; then
  echo "${DIM}Dry run. Re-run with --apply to remove the items above marked removable.${RST}"
  exit 0
fi

if [ "$n_br" = 0 ] && [ "$n_wt" = 0 ] && [ "$PRUNABLE" = 0 ]; then
  echo "${GRN}Nothing to remove.${RST}"; exit 0
fi

if [ "$YES" = 0 ]; then
  printf 'Remove %s branch(es) and %s worktree(s)? [y/N] ' "$n_br" "$n_wt"
  read -r reply </dev/tty
  case "$reply" in y|Y|yes|YES) ;; *) echo "Aborted."; exit 1 ;; esac
fi

[ "$PRUNABLE" != 0 ] && git worktree prune --verbose

while IFS=$'\t' read -r path _ dirty; do
  if [ "$dirty" = 1 ]; then git worktree remove --force "$path"; else git worktree remove "$path"; fi \
    && echo "${GRN}removed worktree${RST} $(tildify "$path")" \
    || warn "couldn't remove worktree $path"
done <"$RM_WT"

while IFS=$'\t' read -r br _; do
  git branch -D --quiet "$br" && echo "${GRN}deleted branch${RST} $br" || warn "couldn't delete $br"
done <"$RM_BR"
