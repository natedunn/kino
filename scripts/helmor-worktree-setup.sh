#!/usr/bin/env bash
set -euo pipefail

# Helmor setup script: runs inside the new worktree after Helmor creates it.
# NOTE: this lives in each worktree at scripts/helmor-worktree-setup.sh and is
# invoked by a tiny bootstrap stored in Helmor's repo settings. The full script
# can't live in Helmor's settings directly: Helmor types it into the workspace
# PTY as one `eval '<script>'` line, and macOS PTYs drop input past 1024
# bytes/line; anything longer gets truncated and parse-fails silently.

readonly TOTAL_STEPS=5

step() {
  printf "\n==> [%s/%s] %s\n" "$1" "$TOTAL_STEPS" "$2"
}

detail() {
  printf "    %s\n" "$1"
}

WORKTREE_ROOT=$(git rev-parse --show-toplevel)

# Main worktree is always first in the list.
MAIN_ROOT=$(git worktree list | head -1 | awk '{print $1}')

# Guard: don't run if we somehow ARE the main worktree.
if [ "$WORKTREE_ROOT" = "$MAIN_ROOT" ]; then
  echo "Running in main worktree, skipping worktree setup"
  exit 0
fi

step 1 "Sync local environment files from main worktree"

# Required env files. .env.local is the canonical one (Convex CLI manages it);
# .env is optional legacy, copied if it exists, but prefer .env.local.
FILES=(".env.local" ".env" ".env.local.example" "convex/.env")

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

step 2 "Install dependencies"
detail "Running pnpm install (timeout 180s)"
run_with_timeout 180 pnpm install

step 3 "Refresh Convex AI files"
detail "Running npx convex ai-files update (timeout 60s)"
run_with_timeout 60 npx convex ai-files update

step 4 "Resolve seed options"
seed_args=(--stop-running-local)
detail "Stopping this worktree's anonymous local Convex backend before seeding, if it is running"

if [[ "${HELMOR_CONVEX_SEED_INCLUDE_FILE_STORAGE:-}" == "1" ]]; then
  detail "Including Convex file storage in the seed snapshot"
  seed_args+=(--include-file-storage)
else
  detail "Skipping Convex file storage"
fi

if [[ -n "${KINO_CONVEX_SEED_SOURCE:-}" ]]; then
  detail "Using seed source: $KINO_CONVEX_SEED_SOURCE"
  seed_args+=(--source "$KINO_CONVEX_SEED_SOURCE")
else
  detail "Using the saved/shared dev seed source"
fi

step 5 "Seed anonymous Convex workspace from shared dev"
detail "This creates/resets the worktree-local anonymous Convex database"
if [ "${#seed_args[@]}" -gt 0 ]; then
  pnpm convex:seed:from-dev "${seed_args[@]}"
else
  pnpm convex:seed:from-dev
fi

printf "\n==> Setup complete. Run pnpm dev to start Portless, Vite, and Convex.\n"
