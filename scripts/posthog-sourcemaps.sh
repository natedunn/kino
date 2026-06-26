#!/usr/bin/env sh
set -eu

if [ -z "${POSTHOG_CLI_API_KEY:-}" ] ||
  [ -z "${POSTHOG_CLI_PROJECT_ID:-}" ] ||
  [ -z "${POSTHOG_CLI_HOST:-}" ]; then
  echo "Skipping PostHog sourcemap upload: missing PostHog CLI environment."
  exit 0
fi

if [ ! -d dist ]; then
  echo "Skipping PostHog sourcemap upload: dist directory does not exist."
  exit 0
fi

release_version="${WORKERS_CI_COMMIT_SHA:-${CF_PAGES_COMMIT_SHA:-${GITHUB_SHA:-${VITE_BUILD_ID:-}}}}"
if [ -z "$release_version" ] && command -v git >/dev/null 2>&1; then
  release_version="$(git rev-parse HEAD 2>/dev/null || true)"
fi
release_version="${release_version:-unknown}"

pnpm exec posthog-cli \
  --host "$POSTHOG_CLI_HOST" \
  sourcemap process \
  --directory dist \
  --release-name kino \
  --release-version "$release_version" \
  --delete-after
