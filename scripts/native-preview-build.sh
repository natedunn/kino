#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"

export VITE_SITE_URL="$NATIVE_APP_PREVIEW_ORIGIN"
export VITE_CONVEX_SITE_URL="${VITE_CONVEX_URL%.convex.cloud}.convex.site"
node scripts/check-native-preview-target.mjs --allow-build-selector
pnpm run build
