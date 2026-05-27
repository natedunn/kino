#!/usr/bin/env sh
set -eu

branch="${1:-${WORKERS_CI_BRANCH:-${CF_BRANCH:-${CF_PAGES_BRANCH:-${CLOUDFLARE_BRANCH:-${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-${BRANCH:-}}}}}}}}"
max_length="${2:-48}"

if [ -z "$branch" ] && command -v git >/dev/null 2>&1; then
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
fi

name="$(printf '%s' "${branch:-preview}" \
  | tr '[:upper:]' '[:lower:]' \
  | sed 's/[^a-z0-9-]/-/g; s/--*/-/g; s/^-//; s/-$//' \
  | cut -c 1-"$max_length")"

printf '%s\n' "${name:-preview}"
