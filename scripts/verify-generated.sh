#!/usr/bin/env bash
set -euo pipefail

WORKTREE_ROOT=$(git rev-parse --show-toplevel)
cd "$WORKTREE_ROOT"

echo "Regenerating native Convex source files..."
pnpm run codegen

# Convex AI guidance is updated separately with `npx convex ai-files update`.
# It is intentionally excluded here because it is tooling documentation, not
# application runtime code.
generated_status=$(git status --short --untracked-files=all -- \
  convex/native/_generated)

if [[ -n "$generated_status" ]]; then
  echo >&2
  echo "Generated application files are out of date:" >&2
  echo "$generated_status" >&2
  echo >&2
  echo "Review and commit the generated changes, then run pnpm run verify:generated again." >&2
  exit 1
fi

echo "Generated application files are up to date."
