#!/usr/bin/env sh
set -eu

branch="${WORKERS_CI_BRANCH:-${CF_BRANCH:-${CF_PAGES_BRANCH:-${CLOUDFLARE_BRANCH:-${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-${BRANCH:-}}}}}}}"
if [ -z "$branch" ] && command -v git >/dev/null 2>&1; then
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
fi
branch="${branch:-local}"

production_branch="${PRODUCTION_BRANCH:-main}"
build_cmd='sh scripts/cloudflare-vite-build.sh'

preview_name="$(sh scripts/preview-name.sh "$branch" 48)"

# Workers Builds env vars apply to every branch, so the gateway target
# registration uses branch-suffixed variants: production builds must register
# with the prod gateway and preview builds with the dev gateway — never
# cross-tier. Unset variants mean registration is skipped (best-effort no-op).
if [ "$branch" = "$production_branch" ]; then
  export GATEWAY_URL="${GATEWAY_URL_PRODUCTION:-}"
  export GATEWAY_ADMIN_TOKEN="${GATEWAY_ADMIN_TOKEN_PRODUCTION:-}"
else
  export GATEWAY_URL="${GATEWAY_URL_PREVIEW:-}"
  export GATEWAY_ADMIN_TOKEN="${GATEWAY_ADMIN_TOKEN_PREVIEW:-}"
fi

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
    --preview-name "$preview_name" \
    --cmd "$build_cmd" \
    --cmd-url-env-var-name VITE_CONVEX_URL

  if [ "${CONVEX_PREVIEW_AUTO_JWKS:-1}" != "0" ]; then
    node scripts/refresh-convex-preview-jwks.mjs "$preview_name"
  fi
fi
