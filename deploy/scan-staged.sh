#!/usr/bin/env bash
# Scans the STAGED diff before a push and exits 1 on anything that must never enter this repository:
# a credential shape, an em or en dash, an attribution line, a private Mac path, or a reference label
# from the real client. Use it as the gate in the commit chain:
#
#   git add -A && bash deploy/scan-staged.sh && git commit -m "..."
#
# The reference-label list is word-bounded and names only words that identify the real company or
# the people around this demo. It is NOT in the repository and must never be: shipping the list
# would publish exactly what it hides. It lives in .private/forbidden_terms.txt (gitignored), one
# term per line, '#' for comments. Extend it there. When the file is absent - a fresh clone, or CI
# - the other four checks still run and this one is skipped with a warning, so an outside build is
# not blocked by a file it cannot have.
set -uo pipefail
cd "$(dirname "$0")/.."
# This script is excluded from its own scan: its patterns carry the very characters it hunts.
added=$(git diff --cached -- . ':!deploy/scan-staged.sh' | grep -E '^\+' | grep -vE '^\+\+\+' || true)
fail=0
report() { echo "scan-staged: $1"; fail=1; }
[ -n "$(printf '%s\n' "$added" | grep -E '[—–]' || true)" ] && report "em or en dash in the staged diff:" && printf '%s\n' "$added" | grep -nE '[—–]' | cut -c1-160
[ -n "$(printf '%s\n' "$added" | grep -iE 'co-authored-by|generated with \[?claude' || true)" ] && report "attribution line in the staged diff"
[ -n "$(printf '%s\n' "$added" | grep -E 'sk-ant-[A-Za-z0-9]|sk-or-[A-Za-z0-9]|ghp_[A-Za-z0-9]|xox[bp]-|BEGIN (RSA|OPENSSH) PRIVATE|CLAUDE_CODE_OAUTH_TOKEN=[A-Za-z0-9]|ANTHROPIC_API_KEY=[A-Za-z0-9]' || true)" ] && report "credential-shaped string in the staged diff"
[ -n "$(printf '%s\n' "$added" | grep -E '/Users/[a-z]' || true)" ] && report "private Mac path in the staged diff"
TERMS=${FORBIDDEN_TERMS:-.private/forbidden_terms.txt}
if [ -f "$TERMS" ]; then
  label_pattern=$(grep -v '^#' "$TERMS" | grep -v '^[[:space:]]*$' | sed 's/[.[\*^$\/]/\\&/g' | paste -sd'|' -)
  if [ -n "$label_pattern" ]; then
    [ -n "$(printf '%s\n' "$added" | grep -iE "\b($label_pattern)\b" || true)" ] && report "reference label from the real client in the staged diff"
  else
    echo "scan-staged: WARNING - $TERMS has no terms; the reference-label check is SKIPPED."
  fi
else
  echo "scan-staged: WARNING - no terms file at $TERMS; the reference-label check is SKIPPED."
  echo "scan-staged: the dash, attribution, credential and Mac-path checks above still ran."
fi
if [ "$fail" = 1 ]; then echo "scan-staged: FAILED, nothing committed"; exit 1; fi
echo "scan-staged: clean ($(printf '%s\n' "$added" | grep -c . ) added lines)"
