#!/usr/bin/env sh
# Build command run by `npx convex deploy --cmd` with VITE_CONVEX_URL injected
# for the target Convex deployment. Derives the Convex site URL, registers
# this deployment's GitHub webhook receiver with the gateway (best-effort), and
# runs the Vite build.
set -eu

VITE_CONVEX_SITE_URL="$(printf "%s" "$VITE_CONVEX_URL" | sed "s/\.convex\.cloud$/.convex.site/")"
export VITE_CONVEX_SITE_URL

node scripts/gateway-webhook-target.mjs register "${VITE_CONVEX_SITE_URL}/api/github/webhook" || true

pnpm run build
