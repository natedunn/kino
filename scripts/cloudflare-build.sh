#!/usr/bin/env sh
set -eu

branch="${WORKERS_CI_BRANCH:-${CF_BRANCH:-${CF_PAGES_BRANCH:-${CLOUDFLARE_BRANCH:-${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-${BRANCH:-}}}}}}}"
if [ -z "$branch" ] && command -v git >/dev/null 2>&1; then
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
fi
branch="${branch:-local}"

production_branch="${PRODUCTION_BRANCH:-main}"
build_cmd='sh scripts/cloudflare-vite-build.sh'

convex_preview_name="$(sh scripts/preview-name.sh "$branch" 48)"
cloudflare_alias="$(sh scripts/preview-name.sh "$branch" 40)"

# Workers Builds env vars apply to every branch, so the gateway target
# registration uses branch-suffixed variants: production builds must register
# with the prod gateway and preview builds with the dev gateway — never
# cross-tier. Native auth values are mandatory because a partial configuration
# would publish an app that cannot complete sign-in.
if [ "$branch" = "$production_branch" ]; then
  export GATEWAY_URL="${GATEWAY_URL_PRODUCTION:-}"
  export GATEWAY_ADMIN_TOKEN="${GATEWAY_ADMIN_TOKEN_PRODUCTION:-}"
  export VITE_POSTHOG_PROJECT_TOKEN="${POSTHOG_PROJECT_TOKEN_PRODUCTION:-}"
  export VITE_POSTHOG_HOST="${POSTHOG_HOST_PRODUCTION:-}"
  export POSTHOG_CLI_API_KEY="${POSTHOG_CLI_API_KEY_PRODUCTION:-}"
  export POSTHOG_CLI_PROJECT_ID="${POSTHOG_CLI_PROJECT_ID_PRODUCTION:-}"
  export POSTHOG_CLI_HOST="${POSTHOG_CLI_HOST_PRODUCTION:-${POSTHOG_HOST_PRODUCTION:-}}"
  export VITE_SITE_URL="${NATIVE_APP_ORIGIN_PRODUCTION:-}"
  export NATIVE_GITHUB_GATEWAY_URL="${NATIVE_GITHUB_GATEWAY_URL_PRODUCTION:-}"
  export NATIVE_GITHUB_ROUTE_ID="${NATIVE_GITHUB_ROUTE_ID_PRODUCTION:-}"
  export NATIVE_GITHUB_ROUTE_SECRET="${NATIVE_GITHUB_ROUTE_SECRET_PRODUCTION:-}"
else
  export GATEWAY_URL="${GATEWAY_URL_PREVIEW:-}"
  export GATEWAY_ADMIN_TOKEN="${GATEWAY_ADMIN_TOKEN_PREVIEW:-}"
  export VITE_POSTHOG_PROJECT_TOKEN=""
  export VITE_POSTHOG_HOST=""
  export POSTHOG_CLI_API_KEY=""
  export POSTHOG_CLI_PROJECT_ID=""
  export POSTHOG_CLI_HOST=""
  preview_host_suffix="${NATIVE_APP_PREVIEW_HOST_SUFFIX:-}"
  if [ -z "$preview_host_suffix" ]; then
    echo "Native preview deploy requires NATIVE_APP_PREVIEW_HOST_SUFFIX (for example kino.example.workers.dev)." >&2
    exit 1
  fi
  export VITE_SITE_URL="https://${cloudflare_alias}-${preview_host_suffix}"
  export NATIVE_GITHUB_GATEWAY_URL="${NATIVE_GITHUB_GATEWAY_URL_PREVIEW:-}"
  # The Start Worker derives a distinct route ID from its exact preview origin.
  # A shared route ID would send OAuth callbacks to whichever branch registered last.
  export NATIVE_GITHUB_ROUTE_ID=""
  export NATIVE_GITHUB_ROUTE_SECRET="${NATIVE_GITHUB_ROUTE_SECRET_PREVIEW:-}"
  export NATIVE_GITHUB_REGISTER_PREVIEW_ROUTE=true
fi

if [ -z "$VITE_SITE_URL" ]; then
  echo "Native deploy requires an exact app origin." >&2
  exit 1
fi
if [ -z "$NATIVE_GITHUB_GATEWAY_URL" ]; then
  echo "Native deploy requires the tier's NATIVE_GITHUB_GATEWAY_URL_*." >&2
  exit 1
fi
if { [ "$branch" = "$production_branch" ] && [ -z "$NATIVE_GITHUB_ROUTE_ID" ]; } || [ -z "$NATIVE_GITHUB_ROUTE_SECRET" ]; then
  echo "Native deploy requires the tier's GitHub route ID (production) and route secret." >&2
  exit 1
fi
export VITE_NATIVE_GITHUB_ENABLED=true
node -e '
  const origin = new URL(process.env.VITE_SITE_URL);
  if (origin.protocol !== "https:" || origin.origin !== process.env.VITE_SITE_URL) {
    throw new Error("VITE_SITE_URL must be an exact HTTPS origin");
  }
  const callback = new URL(process.env.NATIVE_GITHUB_GATEWAY_URL);
  if (callback.protocol !== "https:" || callback.pathname !== "/oauth/github/callback" || callback.search || callback.hash) {
    throw new Error("NATIVE_GITHUB_GATEWAY_URL must be an exact HTTPS /oauth/github/callback URL");
  }
'

# Check the independently deployed gateway before Convex can push native code.
if [ "$branch" = "$production_branch" ]; then
  node scripts/check-gateway-auth-version.mjs https://gateway.usekino.com
else
  node scripts/check-gateway-auth-version.mjs https://gateway-dev.usekino.com
fi
node scripts/check-native-preview-gateway.mjs

if [ "$branch" = "$production_branch" ]; then
  if [ -z "${CONVEX_PROD_DEPLOY_KEY:-}" ]; then
    echo "Missing CONVEX_PROD_DEPLOY_KEY for production branch '$branch'." >&2
    exit 1
  fi

  export CONVEX_DEPLOY_KEY="$CONVEX_PROD_DEPLOY_KEY"
  # These non-secret values are part of the release input. Set them on the
  # exact deployment before Convex validates the declared environment.
  npx convex env set AUTH_APP_ORIGIN "$VITE_SITE_URL"
  npx convex env set AUTH_GITHUB_CALLBACK_URL "$NATIVE_GITHUB_GATEWAY_URL"
  # This Cloudflare "build" step intentionally deploys Convex as a prerequisite
  # for the Worker deploy that runs later in `scripts/cloudflare-deploy.sh`.
  # That means one Workers Builds job has two deploy phases:
  # 1. here: native Convex schema/functions via `convex deploy`
  # 2. later: the Cloudflare Worker/assets via Wrangler
  #
  # We keep this ordering so a Convex failure aborts the Cloudflare release
  # before Wrangler publishes the frontend. It is not a cross-service atomic
  # transaction though: if Wrangler fails later, Convex may already be updated.
  # The native backend uses Convex indexes and explicit application migrations;
  # it has no Kitcn aggregate-index backfill phase.
  npx convex deploy \
    --cmd "$build_cmd" \
    --cmd-url-env-var-name VITE_CONVEX_URL
else
  if [ -z "${CONVEX_MANAGEMENT_TOKEN:-}" ]; then
    echo "Missing CONVEX_MANAGEMENT_TOKEN for preview branch '$branch'." >&2
    exit 1
  fi
  if [ -z "${CONVEX_TEAM_SLUG:-}" ] || [ -z "${CONVEX_PROJECT_SLUG:-}" ]; then
    echo "Native preview deploy requires CONVEX_TEAM_SLUG and CONVEX_PROJECT_SLUG." >&2
    exit 1
  fi
  if [ -z "${CONVEX_PREVIEW_DEPLOY_KEY:-}" ]; then
    echo "Native preview deploy requires CONVEX_PREVIEW_DEPLOY_KEY." >&2
    exit 1
  fi

  # A management token is required here because the branch-specific app origin
  # cannot be a shared Convex preview default. Preview and project deploy keys
  # can create or deploy previews, but the current CLI cannot use either to
  # authorize a specific preview for environment updates.
  unset CONVEX_DEPLOY_KEY CONVEX_DEPLOYMENT_TOKEN
  export CONVEX_OVERRIDE_ACCESS_TOKEN="$CONVEX_MANAGEMENT_TOKEN"
  preview_selector="${CONVEX_TEAM_SLUG}:${CONVEX_PROJECT_SLUG}:preview/${convex_preview_name}"
  if ! npx convex env list --deployment "$preview_selector" --names-only >/dev/null 2>&1; then
    npx convex deployment create "${CONVEX_TEAM_SLUG}:${CONVEX_PROJECT_SLUG}:${convex_preview_name}" \
      --type preview \
      --expiration "${CONVEX_PREVIEW_EXPIRATION:-in 14 days}"
  fi
  npx convex env set --deployment "$preview_selector" AUTH_APP_ORIGIN "$VITE_SITE_URL"
  npx convex env set --deployment "$preview_selector" AUTH_GITHUB_CALLBACK_URL "$NATIVE_GITHUB_GATEWAY_URL"
  preview_github_client_id="$(npx convex env get AUTH_GITHUB_CLIENT_ID --deployment "$preview_selector")"
  preview_github_client_secret="$(npx convex env get AUTH_GITHUB_CLIENT_SECRET --deployment "$preview_selector")"
  if [ -z "$preview_github_client_id" ] || [ "$preview_github_client_id" = 'local-not-configured' ] || \
    [ -z "$preview_github_client_secret" ] || [ "$preview_github_client_secret" = 'local-not-configured' ]; then
    echo "Convex preview GitHub OAuth credentials are missing or placeholders." >&2
    exit 1
  fi
  unset preview_github_client_id preview_github_client_secret
  # This pinned Convex CLI accepts --deployment for env commands, but deploy
  # selects previews through a preview deploy key plus --preview-name.
  unset CONVEX_OVERRIDE_ACCESS_TOKEN
  export CONVEX_DEPLOY_KEY="$CONVEX_PREVIEW_DEPLOY_KEY"
  # Preview builds follow the same two-phase model as production: Convex first,
  # then the Cloudflare Worker/assets deploy step later in the Workers pipeline.
  npx convex deploy \
    --preview-name "$convex_preview_name" \
    --cmd "$build_cmd" \
    --cmd-url-env-var-name VITE_CONVEX_URL
fi
