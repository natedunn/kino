# Kino infrastructure Workers

Workers in this directory own stable shared subdomains and deploy independently
from the Git-connected `kino` application Worker. Cloudflare Workers Builds
pins that application build to the `kino` Worker name, so application deploy
scripts must not deploy sibling Workers from this directory.

Each service follows the same release interface:

```sh
cd workers/<service>
pnpm install
pnpm types
pnpm typecheck
pnpm test

pnpm deploy:preview
# Verify the shared preview/dev hostname.

pnpm deploy:production
# Verify the production hostname.
```

Deploy preview first and promote the same source to production only after its
health check and service-specific behavior pass. A deployed infrastructure
Worker keeps running across normal application releases; redeploy it only when
its own source, bindings, routes, variables, or secrets change.

## Current services

| Package | Shared preview/dev Worker | Production Worker |
| --- | --- | --- |
| `workers/gateway` | `kino-gateway-dev` at `gateway-dev.usekino.com` | `kino-gateway` at `gateway.usekino.com` |
| `workers/files` | `kino-files-preview` at `files-preview.usekino.com` | `kino-files` at `files.usekino.com` |

## Adding another subdomain Worker

1. Create a standalone `workers/<service>` package with its own lockfile.
2. Define explicit preview/dev and production environments in `wrangler.jsonc`.
3. Give each environment a distinct Worker name, custom domain, and tier-correct
   bindings.
4. Expose `types`, `typecheck`, `test`, `deploy:preview`, and
   `deploy:production` package scripts.
5. Document the health endpoint, bindings, secrets, and verification commands
   in the package README.
6. Deploy and verify preview before the initial production deployment.

Do not add the service to `scripts/cloudflare-deploy.sh`. If recurring manual
infrastructure releases become burdensome, automate all packages here through
a dedicated infrastructure workflow using an account-scoped Cloudflare token,
not through the Git-connected `kino` Worker build.
