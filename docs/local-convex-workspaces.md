# Local Convex Workspaces

`pnpm dev` runs Convex in anonymous mode by default. Convex stores new
anonymous/local backend state under this worktree's `.convex/` directory, so
parallel Helmor workspaces no longer push schema changes into the same shared
cloud dev deployment. The setup/seed flow copies Convex env vars from the
shared dev deployment into the anonymous backend so required auth/GitHub/R2 env
vars are present before code is pushed.

## Commands

- `scripts/helmor-worktree-setup.sh`: install dependencies, refresh Convex AI
  files, and seed this worktree's anonymous Convex deployment from shared dev.
  Helmor can run this on worktree creation, and rerunning it resets the
  anonymous DB from shared dev. If this worktree's local anonymous Convex
  backend is already running, setup stops it before seeding.
- `pnpm dev` or `pnpm dev:anonymous`: run this workspace's already-seeded
  anonymous Convex deployment plus Vite. If this same worktree has a stale
  local Convex backend still listening, `pnpm dev` stops it before starting a
  fresh one.
- `pnpm dev:shared`: use the old shared Convex dev deployment flow.
- `pnpm convex:seed:from-dev`: replace the active anonymous deployment's data
  with an export from the shared dev deployment.
- `pnpm convex:seed:from-dev --include-file-storage`: include Convex file
  storage in the seed snapshot.
- `pnpm convex:seed:from-dev --no-env`: seed data without copying Convex env
  vars from the shared dev deployment.

## Helmor Setup

Helmor worktree setup should run:

```sh
set -e
WORKTREE_ROOT=$(git rev-parse --show-toplevel)
bash "$WORKTREE_ROOT/scripts/helmor-worktree-setup.sh"
```

The tiny Helmor setting should call the setup script from the current worktree,
not from the main checkout. The setup script itself still copies ignored env
and secret backup files from the main checkout into the worktree.

The setup script runs five numbered steps: env sync, `pnpm install`,
`npx convex ai-files update`, seed option resolution, then
`pnpm convex:seed:from-dev --stop-running-local`. That stops this worktree's
already-running anonymous local backend, creates the anonymous Convex deployment
if needed, pushes the current schema/functions once, copies Convex env vars,
exports shared dev data, and imports it into the anonymous backend with
`--replace-all`. The seed command starts a temporary local Convex backend for
the import and stops it when seeding finishes. On a brand-new worktree there is
no configured local backend yet, so setup lets Convex choose free ports instead
of touching another workspace's running backend.

Set `HELMOR_CONVEX_SEED_INCLUDE_FILE_STORAGE=1` before running setup if the
worktree needs Convex file storage copied too. Set
`KINO_CONVEX_SEED_SOURCE=<deployment-name>` if the shared dev source cannot be
discovered from `.env.local`.

## Shared Dev Source

Before the first anonymous bootstrap, the setup/seed path saves the current
shared dev deployment name from `.env.local` into
`.convex/shared-dev-deployment.env`. The dev supervisor preserves that file if
it still sees a shared dev `.env.local`, and the seed script uses it as the data
source. If a workspace was already converted to anonymous before this file
existed, set or pass the source explicitly:

```sh
KINO_CONVEX_SEED_SOURCE=<deployment-name> pnpm dev
pnpm convex:seed:from-dev --source <deployment-name>
```

Use the deployment name, such as `scrupulous-lemming-700`, not the
`dev:<name>` value from `.env.local`.

## Schema drift between shared dev and the current branch

The shared dev ("OG") deployment can be schema-ahead or schema-behind the branch
you're seeding into, and `convex import --replace-all` rejects rows with fields
the current schema doesn't declare. Before import, the seed script reads
`convex/functions/_generated/dataModel.d.ts` and strips any exported field not
present in the current schema (per table), logging what it dropped. This is
generic — removing a column from `convex/functions/schema.ts` and regenerating
is enough; there is no hardcoded field list to maintain.

Caveat: this handles *removed/renamed* fields. A newly **required** field that
the OG data lacks still needs the widen-migrate-narrow discipline (keep it
optional through the transition) — see the convex-migration-helper skill. If the
generated data model can't be read, seeding warns and imports unchanged; run
`pnpm codegen` first.

## Dev startup ordering

`pnpm dev` starts Convex first and waits for it to push functions and listen
before launching Vite, so the first browser load doesn't hit a not-yet-ready
backend (which previously required a refresh or a restart or two). If Convex
isn't ready after 120s, Vite starts anyway and a warning points at the Convex
log under `$TMPDIR/kino-dev/<workspace>/convex.log`.

## Notes

Anonymous Convex backends are local-only URLs. The gateway webhook registration
script skips localhost targets, so GitHub webhook fan-out remains a shared
cloud/preview deployment feature for now.
