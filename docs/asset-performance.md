# Asset loading and caching

Vite's `vendor-react` chunk matches the exact `react`, `react-dom`, and
`scheduler` package roots. Do not match `/react/` alone: that also captures
`@tiptap/react` and `@base-ui/react`, putting editor and feature code into the
runtime downloaded by every page.

Keep Vite's default 500 kB chunk warning. A warning is a prompt to inspect the
module graph, not a reason to raise the threshold or split files that still
all download on startup. Compare total route preload bytes and editor opening
behavior as well as individual chunk sizes.

## Build comparison

Local production builds on 2026-09-17, before and after correcting the matcher:

| Metric | Before | After |
| --- | ---: | ---: |
| React vendor chunk, uncompressed | 971 kB | 193 kB |
| Homepage JS preloads, uncompressed | 1,499 kB | 1,121 kB |
| Homepage JS preloads, summed gzip | 481 kB | 363 kB |

Homepage totals deduplicate the root and `/` route preload lists from the
generated TanStack Start manifest. They exclude later dynamic imports and
third-party scripts, and are not browser load-time measurements. ProseMirror
code is absent from the new homepage preload set. The existing lazy editor
boundary now keeps that code in the editor chunk. An 851 kB application entry
still exceeds the default warning threshold and is a separate optimization
opportunity.

## Cache policy

`public/_headers` sets `public, max-age=31536000, immutable` only for `/assets/*`.
Reserve this directory for Vite's content-hashed output; never put unversioned
public files there or replace the contents at an existing hashed URL. Changed
assets receive new URLs. HTML, auth, API, manifest, and favicon policies are
unchanged.

The production build copies this file to `dist/client/_headers`. Local Wrangler
checks confirmed the immutable header on JS and CSS, and the existing
`max-age=0, must-revalidate` policy on the unversioned web manifest. Missing
asset requests fall through to the Worker and did not receive the immutable
header.

## Deployment transitions

Browser caching does not guarantee availability of an old lazy chunk that a tab
has never downloaded. Do not assume that a new deployment serves all previous
versions' assets. The existing `StaleBundleWatcher` checks the deployed build
on mount and tab wake, then offers a reload; it does not automatically reload
and discard in-progress work. Its behavior is unchanged by this optimization.

An old tab can still fail to import a removed chunk. This change does not add
asset retention or repair that existing limitation. Before claiming seamless
deployment transitions, test a tab opened before deployment, an unopened editor
chunk, and an unsaved draft across deployment. Local asset-header checks cannot
prove production retention behavior.

Validation for this change: production client/SSR build, TypeScript check,
formatting check, manifest comparison, and local Cloudflare header checks.
Full app/browser smoke testing was unavailable: the preview automation host was
unavailable and the local SSR request failed with a backend network error.
