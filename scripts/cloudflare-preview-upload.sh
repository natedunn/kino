#!/usr/bin/env sh
set -eu

branch="${WORKERS_CI_BRANCH:-${CF_BRANCH:-${CF_PAGES_BRANCH:-${CLOUDFLARE_BRANCH:-${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-${BRANCH:-}}}}}}}"
if [ -z "$branch" ] && command -v git >/dev/null 2>&1; then
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
fi
branch="${branch:-preview}"

alias_name="$(printf '%s' "$branch" \
  | tr '[:upper:]' '[:lower:]' \
  | sed 's/[^a-z0-9-]/-/g; s/--*/-/g; s/^-//; s/-$//' \
  | cut -c 1-40)"
alias_name="${alias_name:-preview}"

wrangler versions upload --config dist/server/wrangler.json --keep-vars --preview-alias "$alias_name"
