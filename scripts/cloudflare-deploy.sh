#!/usr/bin/env sh
set -eu

# Cloudflare Workers Builds invokes this command for the Git-connected `kino`
# Worker. That build credential is intentionally scoped to `kino`; standalone
# infrastructure Workers under workers/ are deployed from their own packages.
branch="${WORKERS_CI_BRANCH:-${CF_BRANCH:-${CF_PAGES_BRANCH:-${CLOUDFLARE_BRANCH:-${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-${BRANCH:-}}}}}}}"
if [ -z "$branch" ] && command -v git >/dev/null 2>&1; then
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
fi
branch="${branch:-local}"
production_branch="${PRODUCTION_BRANCH:-main}"

# Preview builds already bake their branch-specific gateway route into the
# generated Wrangler config. Production uses fixed build variables and must
# copy them into the app Worker's runtime bindings explicitly.
if [ "$branch" != "$production_branch" ]; then
  exec pnpm exec wrangler deploy --config dist/server/wrangler.json --keep-vars
fi

if [ -z "${NATIVE_GITHUB_GATEWAY_URL_PRODUCTION:-}" ] || \
  [ -z "${NATIVE_GITHUB_ROUTE_ID_PRODUCTION:-}" ] || \
  [ -z "${NATIVE_GITHUB_ROUTE_SECRET_PRODUCTION:-}" ]; then
  echo "Native production deploy requires the GitHub gateway URL, route ID, and route secret." >&2
  exit 1
fi

node -e '
  const gateway = new URL(process.env.NATIVE_GITHUB_GATEWAY_URL_PRODUCTION);
  if (gateway.protocol !== "https:" || gateway.pathname !== "/oauth/github/callback" ||
      gateway.username || gateway.password || gateway.search || gateway.hash) {
    throw new Error("NATIVE_GITHUB_GATEWAY_URL_PRODUCTION must be an exact HTTPS /oauth/github/callback URL");
  }
  if (!/^[a-z0-9-]{1,64}$/.test(process.env.NATIVE_GITHUB_ROUTE_ID_PRODUCTION)) {
    throw new Error("NATIVE_GITHUB_ROUTE_ID_PRODUCTION is invalid");
  }
  if (process.env.NATIVE_GITHUB_ROUTE_SECRET_PRODUCTION.length < 32) {
    throw new Error("NATIVE_GITHUB_ROUTE_SECRET_PRODUCTION is too short");
  }
'

secrets_file="$(mktemp)"
chmod 600 "$secrets_file"
trap 'rm -f "$secrets_file"' EXIT
NATIVE_PRODUCTION_SECRETS_FILE="$secrets_file" node -e '
  const fs = require("node:fs");
  fs.writeFileSync(process.env.NATIVE_PRODUCTION_SECRETS_FILE,
    JSON.stringify({ NATIVE_GITHUB_ROUTE_SECRET: process.env.NATIVE_GITHUB_ROUTE_SECRET_PRODUCTION }));
'

pnpm exec wrangler deploy \
  --config dist/server/wrangler.json \
  --keep-vars \
  --var "NATIVE_GITHUB_GATEWAY_URL:$NATIVE_GITHUB_GATEWAY_URL_PRODUCTION" \
  --var "NATIVE_GITHUB_ROUTE_ID:$NATIVE_GITHUB_ROUTE_ID_PRODUCTION" \
  --secrets-file "$secrets_file"
