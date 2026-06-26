<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/functions/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## GitHub integration & gateway

When working on anything involving GitHub auth (login), the Kino Relay GitHub
App (org/repo sync), webhooks, or `workers/gateway/`, **read
`docs/github-environments.md` first**. It documents the Auth/Relay/Gateway
naming scheme, the per-tier architecture, and a set of invariants (better-auth
version locking, the load-bearing redirect rewrite, bundler traps, Convex
schema-vs-prod-data validation) where violations pass local tests but break
deployed OAuth flows.

## Analytics / PostHog

When adding or changing user-facing product flows, consider whether the change
should emit a PostHog event. Do not add analytics by default. Track only events
that help understand activation, conversion, retention, important feature usage,
or user-visible failures.

Before adding or changing analytics events, read `docs/analytics.md` for naming,
privacy, and event-shape rules.
