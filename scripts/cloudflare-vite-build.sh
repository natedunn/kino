#!/usr/bin/env sh
# Build command run by `npx convex deploy --cmd` with VITE_CONVEX_URL injected
# for the target Convex deployment. Derives the Convex site URL, registers
# this deployment's GitHub webhook receiver with the gateway (best-effort), and
# runs the Vite build.
set -eu

VITE_CONVEX_SITE_URL="$(printf "%s" "$VITE_CONVEX_URL" | sed "s/\.convex\.cloud$/.convex.site/")"
export VITE_CONVEX_SITE_URL

# Cloudflare's Node build container can OOM during the SSR bundle on this app's
# current module graph. Raise the heap for deploy builds only; local dev/builds
# can still override or provide their own NODE_OPTIONS explicitly.
case " ${NODE_OPTIONS:-} " in
  *" --max-old-space-size="*) ;;
  *)
    max_old_space_size="${KINO_BUILD_MAX_OLD_SPACE_SIZE_MB:-4096}"
    if [ -n "${NODE_OPTIONS:-}" ]; then
      export NODE_OPTIONS="--max-old-space-size=${max_old_space_size} ${NODE_OPTIONS}"
    else
      export NODE_OPTIONS="--max-old-space-size=${max_old_space_size}"
    fi
    ;;
esac

node scripts/gateway-webhook-target.mjs register "${VITE_CONVEX_SITE_URL}/api/github/webhook" || true

pnpm run build

sh scripts/posthog-sourcemaps.sh
