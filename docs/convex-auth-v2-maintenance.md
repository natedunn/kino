# Convex Auth v2 patch maintenance

Kino pins `@convex-dev/auth` to the exact npm release `2.0.0-beta.0`, with one
reproducible pnpm patch at `patches/convex-auth-v2-beta.0.patch`. Do not move
it to a `reboot` commit, a tag, or a range; see the release policy below for
when the pin changes.

## Patch inventory

The patch contains three isolated compatibility changes:

1. `revokeUserSessions` in the core component deletes every session of a user
   and its refresh tokens, so a completed password reset revokes every existing
   refresh session (`convex/native/password.ts`). It runs in the reset mutation's
   transaction. Remove it when a release ships equivalent revocation callable
   from an app mutation, and call that instead.
2. A server-configured OAuth callback URL (`CALLBACK_URL` on the GitHub
   component, read in `lib/oauth/dbHelpers`) lets the stable Kino gateway front
   environment-specific Convex callbacks. Remove this when upstream supports
   the same callback boundary without a patch.
3. A package export for `@convex-dev/auth/components/password/validation`.
   Kino's password method calls `validateNewPassword` before creating the user,
   so a rejected password creates no account. Remove it when upstream exports
   password validation publicly, or when Kino stops pre-validating.

Kino's password method also calls `AuthCore.bindProvider`, which beta.0 marks
`@internal` and publishes only under the `convex-auth-internal-types` export
condition. The root and Convex tsconfigs enable that condition; no patch is
needed, but the API may change without notice in a later release.

Each change is applied to the package's TypeScript source and to its emitted
`dist` runtime and declarations (including `dist/internal-types`).
`scripts/check-native-auth-package.mjs` checks the exact pin and the emitted
markers, so a missing patch or accidental upgrade fails PR verification.

The former refresh-successor patch was dropped in the beta.0 upgrade: upstream's
issued/redeemed refresh tokens keep the most recently redeemed token valid, so a
client whose refresh response was lost can retry with the token it still holds
and receive a fresh successor.

## Release policy

Kino follows npm releases of `@convex-dev/auth` (beta, then stable), not
`reboot` commits, and carries a patch only where a release falls short.

- Pin the exact version (no range), regenerate or remove the patch, and follow
  later beta and stable releases. Alpha releases are skipped.
- Each upgrade is its own PR, "Upgrade @convex-dev/auth to <version>", with
  the manual steps for every environment (table clears, env var changes,
  expected sign-outs) in its description.

Upstream replacements for each patch change, and for the patch changes the
beta.0 upgrade retired:

| Patch change                                                   | Upstream replacement                                                                                                                                                                                                                                                                                                          | Released?                                                                                        |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Session revocation on password reset (was session generations) | Stateful sessions [#757](https://github.com/get-convex/convex-auth/pull/757), `listSessions`/`revokeSessions` [#759](https://github.com/get-convex/convex-auth/pull/759), password-reset revocation [#775](https://github.com/get-convex/convex-auth/pull/775) and [#779](https://github.com/get-convex/convex-auth/pull/779) | No. Merged to `reboot` October 26-28, 2026, after `2.0.0-beta.0`; ported as `revokeUserSessions` |
| Server-configured OAuth callback URL                           | None; no upstream PR                                                                                                                                                                                                                                                                                                          | No. Carried as a patch                                                                           |
| Password validation export                                     | None; trimmed from the public API in [#691](https://github.com/get-convex/convex-auth/pull/691)                                                                                                                                                                                                                               | No. Carried as a patch                                                                           |
| Deterministic refresh successors (dropped)                     | Issued/redeemed refresh tokens [#686](https://github.com/get-convex/convex-auth/pull/686)                                                                                                                                                                                                                                     | Yes, in `2.0.0-beta.0`                                                                           |

Adopted release: `2.0.0-beta.0` (upgrade opened November 2, 2026).

Target release: the next beta or stable release. Expect it to include #757-#787:
session IDs in the JWT `sub` (so `convex/native/identity.ts` must use
`getAuthUserId`), deployment-issued JWTs (no `AUTH_PRIVATE_KEY`/`AUTH_JWKS`,
Convex 1.48), and another `auth/sessions` and `auth/refreshTokens` clear.

## Upstream review

### October 29, 2026 review

Reviewed `reboot` from `de1ddf385d3723dea832cbcb7e548b08dbc7b5d4` through
`db15c82e6f568d7717563783447010f9a5534359` (October 28), 65 commits. npm now has
`beta` → `2.0.0-beta.0` (October 15, commit `8c28cad`); `alpha` is still
`2.0.0-alpha.2` and `latest` is `0.0.96`. `reviewedUpstreamSha` is deliberately
left unchanged because this range needs action. Kino stays on the installed pin
and patch until a planned upgrade.

Every patch target moved or was rewritten, so the current patch will not apply
to the `reboot` head:

- `components/core/public.ts` and `schema.ts`: rewritten as
  `packages/core/src/component/public.ts` and `schema.ts`. `spentRefreshTokens`
  and `sessions.refreshTokenHash` are gone; refresh tokens now live in a
  `refreshTokens` table with `issued`/`redeemed`/`spent`/`dropped` states.
- `components/core/_generated/component.ts`: moved to
  `packages/core/src/component/_generated/component.ts`. The core component
  now exposes `listSessions` and `revokeSessions`.
- `oauth/component/convex.config.ts`: moved to
  `packages/core/src/components/oauth/convex.config.ts`. The dedicated GitHub
  component is `packages/core/src/components/github/convex.config.ts`
  (component name `authGithub`). Neither declares `CALLBACK_URL`.
- `oauth/shared/dbHelpers.ts`: moved to
  `packages/core/src/lib/oauth/dbHelpers.ts`. The callback URL is still
  `${CONVEX_SITE_URL}${CALLBACK_PATH}`.

Removal conditions:

1. Session generations: met on `reboot`, not in any npm release. Stateful
   session auth
   ([#757](https://github.com/get-convex/convex-auth/pull/757)) makes deleted
   sessions stop authorizing access tokens. Session revocation
   ([#759](https://github.com/get-convex/convex-auth/pull/759)) adds
   `listSessions`/`revokeSessions` component functions callable from app
   mutations, and [#775](https://github.com/get-convex/convex-auth/pull/775) and
   [#779](https://github.com/get-convex/convex-auth/pull/779) add
   `ctx.convexAuth.revokeAllSessions(userId)` used by upstream password
   recovery. Kino's own reset in `convex/native/password.ts` can call
   `listSessions` + `revokeSessions` in the same mutation instead of the patched
   `revokeUserSessions`. Open [#783](https://github.com/get-convex/convex-auth/pull/783)
   (100-session cap) and [#761](https://github.com/get-convex/convex-auth/pull/761)
   (reactive sign-out) are related.
2. Callback URL: not met. No upstream equivalent and no open PR for it. On
   upgrade, re-port the override to `lib/oauth/dbHelpers.ts` and declare
   `CALLBACK_URL` in both the generic and GitHub component configs. Open
   [#742](https://github.com/get-convex/convex-auth/pull/742) and
   [#744](https://github.com/get-convex/convex-auth/pull/744) touch the same
   callback code.
3. Refresh successors: met on `reboot`, and in `2.0.0-beta.0`. The new refresh
   scheme ([#686](https://github.com/get-convex/convex-auth/pull/686)) keeps
   the most recently redeemed token valid, so a client whose response was lost
   can refresh again with it, up to `STANDARD_ISSUED_REFRESH_TOKEN_LIMIT` (3)
   unredeemed successors. The patch could not be carried anyway, because
   deployment-issued JWTs ([#787](https://github.com/get-convex/convex-auth/pull/787))
   remove `AUTH_PRIVATE_KEY`, which the HMAC derivation uses. Open
   [#781](https://github.com/get-convex/convex-auth/pull/781) changes refresh
   token expiry.

Breaking changes an upgrade must follow:

- JWT `sub` is now the session ID, not the user ID (#757). `convex/native/identity.ts`
  normalizes `identity.subject` as a `users` ID and must switch to
  `getAuthUserId`.
- Requires `convex` 1.48.0 and `convex-test` 0.0.65 (#787); Kino has 1.46.0 and
  `^0.0.56`. Signing keys and JWKS env vars are no longer used.
- The session refresh rework requires clearing the `auth/sessions` table
  (CHANGELOG), which signs everyone out.
- Import paths were reorganized
  ([#692](https://github.com/get-convex/convex-auth/pull/692),
  [#688](https://github.com/get-convex/convex-auth/pull/688)): `core/*`,
  `providers/*`, and `lib/*` subpaths Kino imports no longer exist (now `.`,
  `./server`, `./components/<name>/…`, `./methods/<name>/…`). Components are
  prefixed with `auth` ([#690](https://github.com/get-convex/convex-auth/pull/690)),
  `setupCore` is `setupConvexAuth`
  ([#706](https://github.com/get-convex/convex-auth/pull/706)), and the React
  hooks and `auth.ts` functions were renamed
  ([#693](https://github.com/get-convex/convex-auth/pull/693),
  [#694](https://github.com/get-convex/convex-auth/pull/694)).

Recommendation: plan an upgrade to a `reboot` commit at or after `db15c82` (or
the next beta that includes #757–#779) rather than continuing to carry three
patches on the old pin. It drops the session-generation and refresh-successor
patches and leaves only the callback URL patch, re-ported to the new paths. Run
the full proof set in the review procedure, including a deliberate
lost-refresh-response proof against upstream's new behavior. See the
[upstream comparison](https://github.com/get-convex/convex-auth/compare/de1ddf385d3723dea832cbcb7e548b08dbc7b5d4...db15c82e6f568d7717563783447010f9a5534359).

### October 3, 2026 review

Reviewed `reboot` through `de1ddf385d3723dea832cbcb7e548b08dbc7b5d4`
(October 2), 43 commits beyond the installed pin and 34 beyond the previous
review. The npm alpha tag still points to `2.0.0-alpha.2`. Kino intentionally
retains the installed pin and all three compatibility patches; this review does
not establish compatibility with the newer source.

- The core session implementation, schema, and generated component interface
  are unchanged from the installed pin. Upstream still has no equivalent
  reset-time session revocation or recoverable refresh successor.
- GitHub and Google now have dedicated OAuth components. A future upgrade must
  move Kino's GitHub registration to
  `@convex-dev/auth/providers/oauth/github/convex.config`, add `CALLBACK_URL` to
  that component, and preserve the shared callback override. The generic
  component's existing patch alone will not cover the new GitHub component.
  Update `patchTargets`, the emitted-runtime marker check, generated bindings,
  and OAuth component test fixtures together.
- The new email/password recipe uses Resend, browser-bound email challenges,
  user-ID account mappings, and empty callback profiles. Recovery issues a new
  session without revoking old sessions. Adopting it is a separate migration
  from Kino's Bento delivery, app-owned challenges, email account mappings,
  registration metadata, and reset-without-sign-in contract.
- Email challenge ownership checks and rate-limited email lookup affect the
  upstream email component, which Kino's custom password flow does not use.
  Initial TOTP enrollment does not replace any Kino compatibility patch.

The installed package/runtime marker check and 58 targeted backend, route,
client, and server auth tests passed. No upgrade or deployed OAuth proof was
performed. See the
[upstream comparison](https://github.com/get-convex/convex-auth/compare/50082b5951118e11365dac2042c587881c2b19a1...de1ddf385d3723dea832cbcb7e548b08dbc7b5d4).

### Review procedure

The weekly `Check Convex Auth v2 upstream` workflow compares the recorded
reviewed `reboot` head with the live branch. Run it locally with:

```sh
pnpm run auth:native:check-upstream
```

When it reports a change:

1. Open the printed upstream comparison and inspect every changed file. Changes
   to a path in `patchTargets` require a line-by-line patch review.
2. Check whether upstream now implements any removal condition above. Prefer the
   upstream primitive and delete the corresponding patch hunk when it does.
3. If upgrading, follow the release policy: pin the exact npm version,
   regenerate the pnpm patch from that release's clean source (or remove it),
   and run the package check, auth tests, `pnpm run verify:pr`, GitHub
   callback proof, password-reset revocation proof, and deliberate
   lost-refresh-response proof.
4. If the update is reviewed but Kino intentionally stays pinned, update only
   `reviewedUpstreamSha` in `config/convex-auth-upstream.json`. This acknowledges
   the review; it does not claim compatibility with the newer code.

`scripts/check-native-auth-package.mjs` checks the exact package pin and emitted
runtime markers, so a missing patch or accidental dependency upgrade fails PR
verification.
