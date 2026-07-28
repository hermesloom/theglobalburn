#!/usr/bin/env bash
#
# Promotes main to production, or reports why it cannot.
#
#   npm run release:status    what would ship, and whether the branches are sane
#   npm run release:promote   fast-forward production to main
#
# The invariant this protects: production is always an ancestor of main. Hold it
# and every promotion is a fast-forward that cannot conflict and cannot ship
# anything unreviewed. Break it - by committing straight to production - and the
# next promotion becomes a real merge that can carry surprises in either
# direction.

set -euo pipefail

REMOTE="${RELEASE_REMOTE:-origin}"
MAIN="${RELEASE_MAIN:-main}"
PROD="${RELEASE_PROD:-production}"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
red() { printf '\033[31m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[33m%s\033[0m\n' "$1"; }

git fetch --quiet "$REMOTE" "$MAIN" "$PROD"

MAIN_REF="$REMOTE/$MAIN"
PROD_REF="$REMOTE/$PROD"

# Commits on production that main has never seen. Almost always means somebody
# committed or hotfixed straight to production.
STRANDED=$(git log --oneline "$MAIN_REF..$PROD_REF" | wc -l | tr -d ' ')
# What promoting would actually ship. Use the diff, never the commit list: this
# repo's history has production merged back into main many times, so commit
# ranges routinely claim work is unreleased when its content already shipped.
CHANGED=$(git diff --name-only "$PROD_REF" "$MAIN_REF" | wc -l | tr -d ' ')

bold "release status"
echo "  $MAIN        $(git log -1 --format='%h %s' "$MAIN_REF")"
echo "  $PROD  $(git log -1 --format='%h %s' "$PROD_REF")"
echo

if [ "$STRANDED" -ne 0 ]; then
  red "  production has $STRANDED commit(s) that main does not:"
  git log --format='    %h %an: %s' "$MAIN_REF..$PROD_REF" | head -20
  echo
  yellow "  Fix by merging production back into main first:"
  echo "    git checkout $MAIN && git merge $PROD_REF && git push $REMOTE $MAIN"
  echo
fi

if [ "$CHANGED" -eq 0 ]; then
  green "  nothing to promote - production already matches main"
else
  bold "  $CHANGED file(s) would change:"
  git diff --stat "$PROD_REF" "$MAIN_REF" | tail -20
  echo
  bold "  authors of the work being promoted:"
  git log --format='%an' "$PROD_REF..$MAIN_REF" --no-merges | sort | uniq -c | sed 's/^/    /'
  echo
  yellow "  Check you mean to ship everyone listed above, not just your own work."
fi

if [ "${1:-status}" != "promote" ]; then
  exit 0
fi

echo
if [ "$CHANGED" -eq 0 ]; then
  green "Nothing to do."
  exit 0
fi

if [ "$STRANDED" -ne 0 ]; then
  red "Refusing to promote: production would lose history, or the merge would not"
  red "be a fast-forward. Merge production into main first (command above)."
  exit 1
fi

bold "Promoting $MAIN -> $PROD (fast-forward)..."
git push "$REMOTE" "$MAIN_REF:refs/heads/$PROD"
green "Done. Vercel is deploying production; watch it with:"
echo "  vercel list --prod"
