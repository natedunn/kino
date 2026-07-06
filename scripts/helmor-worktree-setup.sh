#!/usr/bin/env bash
set -euo pipefail

# Back-compat shim. The real logic now lives in scripts/setup-workspace.sh, which
# is tool-agnostic. Setup is a manual step now (`pnpm run setup`, or `pnpm run
# init` to also start the dev server) — it is no longer auto-run from a git hook.
#
# This file only exists so older Helmor repo-settings bootstraps that call
# `scripts/helmor-worktree-setup.sh` keep working. Once Helmor's bootstrap calls
# `pnpm run setup` / `pnpm run init`, this shim can be deleted.

exec bash "$(dirname "$0")/setup-workspace.sh" "$@"
