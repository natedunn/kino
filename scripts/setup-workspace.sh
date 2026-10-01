#!/usr/bin/env bash
set -euo pipefail

# Tool-agnostic workspace setup: prepares a freshly-created git worktree so that
# `pnpm run dev` works. Run it explicitly in a new worktree — either on its own
# (`pnpm run setup`) or via `pnpm run init`, which runs setup and then starts the
# dev server in one shot. Use `pnpm run setup --verify-only` to rerun the final
# check without syncing env files, installing dependencies, or resetting data.
# Nothing here assumes a particular AI/dev app.
#
# NOTE: this is intentionally NOT wired to a git hook. Auto-running it from
# post-checkout made `git worktree add` block for minutes (deps install + Convex
# seed), which tripped the worktree-creation timeouts in tools like T3 Code /
# Conductor. Worktree creation is now instant; setup is a deliberate manual step.
#
# Steps: sync env files from the main worktree, install deps, initialize a fresh
# worktree-local native Convex backend, and verify generated application files
# against that local backend. Prelaunch workspaces intentionally do not import
# the incompatible legacy Kitcn snapshot.

readonly TOTAL_STEPS=5
CURRENT_STEP="Before setup steps"

step() {
  CURRENT_STEP="[$1/$TOTAL_STEPS] $2"
  printf "\n==> [%s/%s] %s\n" "$1" "$TOTAL_STEPS" "$2"
}

detail() {
  printf "    %s\n" "$1"
}

# Use `timeout` (GNU coreutils / macOS 12+) or `gtimeout` (Homebrew) when
# available so hung network commands don't block setup indefinitely.
run_with_timeout() {
  local secs=$1
  shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$secs" "$@"
  elif command -v gtimeout >/dev/null 2>&1; then
    gtimeout "$secs" "$@"
  else
    "$@"
  fi
}

verify_generated() {
  step 5 "Verify generated application files"
  detail "Running pnpm run verify:generated (timeout 120s)"
  run_with_timeout 120 pnpm run verify:generated
}

setup_workspace() {
  if [ "$#" -gt 1 ] || { [ "$#" -eq 1 ] && [ "$1" != "--verify-only" ]; }; then
    echo "Usage: pnpm run setup [--verify-only]" >&2
    exit 2
  fi
  WORKTREE_ROOT=$(git rev-parse --show-toplevel)
  if [ "${1:-}" = "--verify-only" ]; then
    cd "$WORKTREE_ROOT"
    verify_generated
    printf "\n==> Setup verification complete.\n"
    return
  fi

  # Main worktree is always first in the list.
  MAIN_ROOT=$(git worktree list | head -1 | awk '{print $1}')

  # Guard: setup is only meaningful in a secondary worktree (the main checkout is
  # expected to already have its env/deps/Convex set up by the developer).
  if [ "$WORKTREE_ROOT" = "$MAIN_ROOT" ]; then
    echo "Running in the main worktree, skipping workspace setup"
    exit 0
  fi

  step 1 "Sync local environment files from main worktree"

  # Required env files. .env.local is the canonical one (Convex CLI manages it);
  # .env is optional legacy, copied if it exists, but prefer .env.local.
  FILES=(
    ".env.local"
    ".env"
    ".env.local.example"
    "convex/.env"
    ".convex/shared-dev-deployment.env"
  )

  for f in "${FILES[@]}"; do
    if [ -f "$MAIN_ROOT/$f" ]; then
      mkdir -p "$(dirname "$WORKTREE_ROOT/$f")"
      cp "$MAIN_ROOT/$f" "$WORKTREE_ROOT/$f"
      detail "Copied $f"
    fi
  done

  if [ ! -f "$WORKTREE_ROOT/.env.local" ]; then
    detail "WARNING: no .env.local found in main worktree; Convex/dev tooling won't work until it exists"
  fi

  # Key backups (NOT required to run anything; these are the provisioning/
  # recovery copies of the gateway + GitHub app secrets). Copied along so they
  # survive worktree churn; warn if main has lost them as a reminder to restore
  # from 1Password. See docs/github-environments.md.
  BACKUP_FILES=(
    "workers/gateway/secrets.dev.local"
    "workers/gateway/secrets.production.local"
  )

  for f in "${BACKUP_FILES[@]}"; do
    if [ -f "$MAIN_ROOT/$f" ]; then
      mkdir -p "$(dirname "$WORKTREE_ROOT/$f")"
      cp "$MAIN_ROOT/$f" "$WORKTREE_ROOT/$f"
      detail "Copied $f (key backup)"
    else
      detail "WARNING: $f missing from main worktree; not required to run, but it is the key backup for gateway/GitHub secrets. Restore it from 1Password if you still have it."
    fi
  done

  # GitHub App private key(s): same deal, backup only, date-stamped filename.
  PEM_FOUND=0
  for pem in "$MAIN_ROOT"/workers/gateway/*.pem; do
    if [ -f "$pem" ]; then
      mkdir -p "$WORKTREE_ROOT/workers/gateway"
      cp "$pem" "$WORKTREE_ROOT/workers/gateway/"
      detail "Copied workers/gateway/$(basename "$pem") (key backup)"
      PEM_FOUND=1
    fi
  done
  if [ "$PEM_FOUND" = "0" ]; then
    detail "WARNING: no GitHub App .pem in main worktree's workers/gateway/; not required to run, but it is the only copy of the Kino Relay private key. Restore from 1Password, or generate a new key on the GitHub App and re-push it."
  fi

  cd "$WORKTREE_ROOT"

  step 2 "Install dependencies"
  detail "Running pnpm install (timeout 180s)"
  run_with_timeout 180 pnpm install

  step 3 "Select native local initialization"
  detail "Legacy Kitcn snapshot import is disabled for the native schema"

  step 4 "Initialize a fresh native Convex workspace"
  detail "This resets only this worktree's anonymous local Convex database"
  pnpm convex:local:init --reset-local-state

  verify_generated

  printf "\n==> Setup complete. Run pnpm dev to start Portless, Vite, and Convex.\n"
}

# Keep terminal output live while retaining the full transcript if setup fails.
# mktemp creates a private file outside the repository; successful runs remove it.
SETUP_LOG=$(mktemp "${TMPDIR:-/tmp}/kino-setup.XXXXXX")
set +e
(
  set -Eeuo pipefail
  trap 'status=$?; printf "\nSetup failed during %s (line %s, exit %s).\n" "$CURRENT_STEP" "$LINENO" "$status" >&2; exit "$status"' ERR
  setup_workspace "$@"
) 2>&1 | tee "$SETUP_LOG"
setup_statuses=("${PIPESTATUS[@]}")
set -e

setup_status=${setup_statuses[0]}
if [ "$setup_status" -eq 0 ]; then
  setup_status=${setup_statuses[1]}
fi
if [ "$setup_status" -ne 0 ]; then
  printf "\nSetup error log: %s\n" "$SETUP_LOG" >&2
else
  rm -f "$SETUP_LOG"
fi
exit "$setup_status"
