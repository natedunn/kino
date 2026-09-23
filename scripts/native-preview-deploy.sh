#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"

# This entrypoint accepts only the deployment-scoped key for giant-jaguar-319.
# Convex runs the build command before it pushes backend code.
node scripts/check-native-preview-target.mjs
node scripts/check-native-preview-gateway.mjs
export CONVEX_DEPLOY_KEY="$NATIVE_CONVEX_PREVIEW_DEPLOY_KEY"
export VITE_SITE_URL="$NATIVE_APP_PREVIEW_ORIGIN"

cd integrations/native-convex
../../node_modules/.bin/convex deploy \
	--cmd 'bash ../../scripts/native-preview-build.sh' \
	--cmd-url-env-var-name VITE_CONVEX_URL

cd "$root_dir"
pnpm exec wrangler deploy --config integrations/native-convex/wrangler.app-proof.jsonc --keep-vars
