#!/usr/bin/env sh
set -eu

# Cloudflare Workers Builds invokes this command for the Git-connected `kino`
# Worker. That build credential is intentionally scoped to `kino`; standalone
# infrastructure Workers under workers/ are deployed from their own packages.
pnpm exec wrangler deploy --config dist/server/wrangler.json --keep-vars
