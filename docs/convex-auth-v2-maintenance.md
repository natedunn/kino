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
