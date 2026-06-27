#!/usr/bin/env bash
set -euo pipefail

# Back-compat shim. The real logic now lives in scripts/setup-workspace.sh, which
# is tool-agnostic and also runs automatically via the post-checkout git hook
# (see scripts/git-hooks/post-checkout) and `pnpm run setup`.
#
# This file only exists so older Helmor repo-settings bootstraps that call
# `scripts/helmor-worktree-setup.sh` keep working. Once Helmor's bootstrap calls
# `pnpm run setup` (or relies on the git hook), this shim can be deleted.

exec bash "$(dirname "$0")/setup-workspace.sh" "$@"
