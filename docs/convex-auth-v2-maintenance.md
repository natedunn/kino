# Convex Auth v2 patch maintenance

Kino pins `@convex-dev/auth` to commit
`1d105a04d124785441ce655cef33b54103c7bc2e` on the upstream `reboot`
branch. Do not replace it with a tag, range, or newer commit as routine dependency
maintenance. The package is alpha software and Kino carries one reproducible pnpm
patch at `patches/convex-auth-v2-reboot.patch`.

## Patch inventory

The patch contains three isolated compatibility changes:

1. Session generations let a completed password reset revoke every existing
   refresh session for that user. Remove this when upstream exposes equivalent
   transactional revocation.
2. A server-configured OAuth callback URL lets the stable Kino gateway front
   environment-specific Convex callbacks. Remove this when upstream supports
   the same callback boundary without a core patch.
3. Deterministic refresh successors let a retry inside the existing 30-second
   grace window recover the exact token produced by the first rotation. This
   prevents a lost refresh response from forcing a later sign-in. Remove it when
   upstream offers equivalent idempotent or acknowledged refresh recovery.

The refresh patch stores only hashes, as upstream does. It derives a successor
with HMAC-SHA-256 from the auth private key, session ID, and previous token hash.
The domain string is `kino-convex-auth-refresh-recovery-v1`. A client holding the
immediately previous token can recover its successor during the existing grace
window; after the session advances again it receives only upstream's access-token
reuse response, and replay outside the grace window still revokes the session.
This is an explicit availability/security tradeoff. Rotating `AUTH_PRIVATE_KEY`
can prevent recovery of an in-flight old response during that brief window, but
does not invalidate a current refresh token.

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
3. If upgrading, pin the exact new commit, regenerate the pnpm patch from clean
   upstream source, and run the package check, auth tests, `pnpm run verify:pr`,
   GitHub callback proof, password-reset revocation proof, and deliberate
   lost-refresh-response proof.
4. If the update is reviewed but Kino intentionally stays pinned, update only
   `reviewedUpstreamSha` in `config/convex-auth-upstream.json`. This acknowledges
   the review; it does not claim compatibility with the newer code.

`scripts/check-native-auth-package.mjs` checks the exact package pin and emitted
runtime markers, so a missing patch or accidental dependency upgrade fails PR
verification.
