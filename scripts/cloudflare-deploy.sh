#!/usr/bin/env sh
set -eu

# Cloudflare Workers Builds invokes this command for the production branch.
# Deploy the shared file-delivery tiers before the app that emits their URLs.
# Wrangler creates the Workers, R2 bindings, custom domains, and DNS records on
# the first run; subsequent runs update the existing Workers.
pnpm exec wrangler deploy --config workers/files/wrangler.jsonc --env preview
pnpm exec wrangler deploy --config workers/files/wrangler.jsonc --env production

pnpm exec wrangler deploy --config dist/server/wrangler.json --keep-vars
