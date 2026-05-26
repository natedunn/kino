#!/usr/bin/env sh
set -eu

branch="${WORKERS_CI_BRANCH:-${CF_BRANCH:-${CF_PAGES_BRANCH:-${CLOUDFLARE_BRANCH:-${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-${BRANCH:-}}}}}}}"
if [ -z "$branch" ] && command -v git >/dev/null 2>&1; then
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
fi
branch="${branch:-local}"

production_branch="${PRODUCTION_BRANCH:-main}"
build_cmd='VITE_CONVEX_SITE_URL="$(printf "%s" "$VITE_CONVEX_URL" | sed "s/\.convex\.cloud$/.convex.site/")" pnpm run build'

preview_name="$(printf '%s' "$branch" \
  | tr '[:upper:]' '[:lower:]' \
  | sed 's/[^a-z0-9-]/-/g; s/--*/-/g; s/^-//; s/-$//' \
  | cut -c 1-48)"
preview_name="${preview_name:-preview}"

if [ "$branch" = "$production_branch" ]; then
  if [ -z "${CONVEX_PROD_DEPLOY_KEY:-}" ]; then
    echo "Missing CONVEX_PROD_DEPLOY_KEY for production branch '$branch'." >&2
    exit 1
  fi

  export CONVEX_DEPLOY_KEY="$CONVEX_PROD_DEPLOY_KEY"
  npx convex deploy \
    --cmd "$build_cmd" \
    --cmd-url-env-var-name VITE_CONVEX_URL
else
  if [ -z "${CONVEX_PREVIEW_DEPLOY_KEY:-}" ]; then
    echo "Missing CONVEX_PREVIEW_DEPLOY_KEY for preview branch '$branch'." >&2
    exit 1
  fi

  export CONVEX_DEPLOY_KEY="$CONVEX_PREVIEW_DEPLOY_KEY"
  npx convex deploy \
    --preview-create "$preview_name" \
    --cmd "$build_cmd" \
    --cmd-url-env-var-name VITE_CONVEX_URL
fi
