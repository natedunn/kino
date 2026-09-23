# Local Convex Workspaces

`pnpm dev` runs a worktree-local Convex backend by default. Its state lives
under this worktree's `.convex/` directory, so parallel worktrees do not push
schema or function changes into the shared cloud development deployment.

The native schema is intentionally initialized empty. The prelaunch Kitcn data
snapshot is incompatible with the native tables, and setup no longer exports,
rewrites, or imports that legacy data.

## Commands

- `pnpm setup`: copy ignored local configuration from the main worktree,
  install dependencies, initialize a fresh native local backend, and verify
  generated files.
- `pnpm convex:local:init`: initialize the current worktree's native backend.
  Add `--reset-local-state` to discard only this worktree's local database and
  recreate it.
- `pnpm dev` or `pnpm dev:anonymous`: run the worktree-local Convex backend and
  Vite.
- `pnpm dev:shared`: explicitly use the configured shared Convex development
  deployment. Use this only when a cloud callback or shared integration is
  required.
- `pnpm dev:share`: run the local stack behind temporary Cloudflare Quick
  Tunnels for testing on another device.

## Worktree setup

New secondary worktrees should run:

```sh
pnpm setup
```

Setup copies `.env.local`, optional local env files, and the gitignored gateway
key backups from the main worktree. It then runs `pnpm convex:local:init
--reset-local-state`, which generates a local signing key when necessary,
configures the native auth component, pushes the native schema/functions, and
stops its temporary initialization process. Run `pnpm dev` afterward.

The main worktree is not reset by `pnpm setup`; its setup script exits early.
No command copies cloud data into a local database.

## Dev startup ordering

The supervisor starts Convex first and waits for the local backend before it
starts Vite. Logs live under `$TMPDIR/kino-dev/<workspace>/`. If the local
deployment has not been initialized yet, run `pnpm convex:local:init` before
starting development.

The `.convex/shared-dev-deployment.env` file is retained only so the explicit
`pnpm dev:shared` workflow can remember the prior cloud development target. It
is not a seed source.

## Quick Tunnel notes

Ordinary local Convex URLs cannot receive GitHub webhooks. `pnpm dev:share`
registers its temporary public Convex site with the dev gateway for the life of
the session and unregisters it on shutdown. `GATEWAY_URL` and
`GATEWAY_ADMIN_TOKEN` must be present locally, and the dev gateway must have
temporary share-origin support deployed.

Quick Tunnel URLs change on every run and are publicly reachable by anyone who
knows the URL while the command is active. Application authorization still
protects private data, but the development server can expose source modules,
local paths, and project structure. Use it only for temporary development
testing and stop the complete session with Ctrl+C.
