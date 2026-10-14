<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/native/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Pull request verification

Before opening or updating a pull request, run `pnpm run verify:pr`. This
regenerates the Convex application files and fails if the committed generated
output is stale, verifies the pinned Convex Auth package and its patches
(`auth:native:verify-package`), and then runs the TypeScript checks. If
generation changes files, review and commit those files before rerunning the
command.

Workspace setup also runs `pnpm run verify:generated`, and the
`Verify generated files` GitHub Actions workflow runs it on every pull request,
so stale generated runtime code cannot merge silently. The workflow uses a
throwaway anonymous local Convex backend with no secrets. Convex codegen pushes
functions to a deployment, so never run this check in the Cloudflare build,
where it would target the preview or production deployment. The same workflow
runs `pnpm run test:scripts`, the `node:test` suites for `scripts/` (vitest
excludes `scripts/**/*.test.mjs`).

Do not run `npx convex ai-files update` as part of normal setup or PR
verification. Convex AI guidance and installed skills are tooling documentation,
not application runtime output; update and commit them only as an explicit
maintenance change.

## GitHub integration & gateway

When working on anything involving GitHub auth (login), the Kino Relay GitHub
App (org/repo sync), webhooks, or `workers/gateway/`, **read
`docs/github-environments.md` first**. It documents the Auth/Relay/Gateway
naming scheme, the per-tier architecture, and a set of invariants (better-auth
gateway pinning, the load-bearing redirect rewrite, bundler traps, Convex
schema-vs-prod-data validation) where violations pass local tests but break
deployed OAuth flows.

## Analytics / PostHog

When adding or changing user-facing product flows, consider whether the change
should emit a PostHog event. Do not add analytics by default. Track only events
that help understand activation, conversion, retention, important feature usage,
or user-visible failures.

Before adding or changing analytics events, read `docs/analytics.md` for naming,
privacy, and event-shape rules.

## Internationalization

When adding or changing customer-facing UI, transactional emails, notifications,
validation, or errors, **read `docs/internationalization.md` first**. New features
must ship with complete `en-US`, `es-419`, and `zh-Hans` messages in the same PR.
Do not translate user-generated content, internal developer errors, admin/UI-lab
copy, or a deliberately deferred placeholder surface.

When changing gateway auth, matching package files
is not deployment verification. The app release does not deploy the standalone
OAuth gateways. Follow the rollout order in `docs/github-environments.md`, check
the deployed gateway's `/health` auth version, and verify a complete OAuth return
callback and authenticated page before reporting login as validated.
