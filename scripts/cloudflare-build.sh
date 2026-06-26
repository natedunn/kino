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
  export VITE_POSTHOG_PROJECT_TOKEN="${POSTHOG_PROJECT_TOKEN_PRODUCTION:-}"
  export VITE_POSTHOG_HOST="${POSTHOG_HOST_PRODUCTION:-}"
  export POSTHOG_CLI_API_KEY="${POSTHOG_CLI_API_KEY_PRODUCTION:-}"
  export POSTHOG_CLI_PROJECT_ID="${POSTHOG_CLI_PROJECT_ID_PRODUCTION:-}"
  export POSTHOG_CLI_HOST="${POSTHOG_CLI_HOST_PRODUCTION:-${POSTHOG_HOST_PRODUCTION:-}}"
else
  export GATEWAY_URL="${GATEWAY_URL_PREVIEW:-}"
  export GATEWAY_ADMIN_TOKEN="${GATEWAY_ADMIN_TOKEN_PREVIEW:-}"
  export VITE_POSTHOG_PROJECT_TOKEN=""
  export VITE_POSTHOG_HOST=""
  export POSTHOG_CLI_API_KEY=""
  export POSTHOG_CLI_PROJECT_ID=""
  export POSTHOG_CLI_HOST=""
fi

if [ "$branch" = "$production_branch" ]; then
  if [ -z "${CONVEX_PROD_DEPLOY_KEY:-}" ]; then
    echo "Missing CONVEX_PROD_DEPLOY_KEY for production branch '$branch'." >&2
    exit 1
  fi

  export CONVEX_DEPLOY_KEY="$CONVEX_PROD_DEPLOY_KEY"
  # Use `kitcn deploy` (not `convex deploy`) so that, after pushing schema +
  # functions, kitcn runs pending migrations and the aggregateIndex/rankIndex
  # backfill against the just-deployed deployment. Plain `convex deploy` skips
  # this, leaving any newly added aggregate index in BUILDING — which makes
  # ORM count()/aggregate() reads throw COUNT_INDEX_BUILDING in production.
  npx kitcn deploy \
    --cmd "$build_cmd" \
    --cmd-url-env-var-name VITE_CONVEX_URL
else
  if [ -z "${CONVEX_PREVIEW_DEPLOY_KEY:-}" ]; then
    echo "Missing CONVEX_PREVIEW_DEPLOY_KEY for preview branch '$branch'." >&2
    exit 1
  fi

  export CONVEX_DEPLOY_KEY="$CONVEX_PREVIEW_DEPLOY_KEY"
  # `kitcn deploy` also runs migrations + aggregate backfill against the preview
  # deployment (targeted via --preview-name) after the convex push.
  npx kitcn deploy \
    --preview-name "$preview_name" \
    --cmd "$build_cmd" \
    --cmd-url-env-var-name VITE_CONVEX_URL

  if [ "${CONVEX_PREVIEW_AUTO_JWKS:-1}" != "0" ]; then
    node scripts/refresh-convex-preview-jwks.mjs "$preview_name"
  fi
fi
