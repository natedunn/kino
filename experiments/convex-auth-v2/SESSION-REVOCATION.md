# Session revocation proof

September 20, 2026. **135 combined tests pass; TypeScript passes.**

The local proposal closes the refresh-token gap demonstrated in
[the email proof](EMAIL-PROOF.md). It does not change official upstream, the live
GitHub proof, or Kino. It is not yet a supported upstream API or a Kino deployment fix. It is now
installed only in the separate [live local email proof](email/README.md).

## Implementation

The reviewable change is [session-revocation.patch](patches/session-revocation.patch),
applied to an ignored `.revocation/` copy of the pinned source by
`scripts/prepare-revocation.mjs`. `.upstream/` remains pristine. `npm test` rebuilds
the copy before running both original and patched suites.

- A core-owned `sessionGenerations` table stores one generation per app user.
- Session creation reads that generation and stores it on the new session.
- Existing sessions without the optional field are interpreted as generation 0.
- Component mutation `revokeUserSessions({ userId })` increments the generation.
- Every refresh checks the session generation before minting a token, including
  the spent-token/grace-window path. Rotation never upgrades an old generation.
- Invalidating sessions requires one indexed read and one write, regardless of
  the number of sessions. It does not scan/delete all sessions during reset.

The test provider's `resetPasswordWithRevocation` consumes a valid recovery proof,
replaces the password, and calls this component mutation in one outer mutation.
Its caller cannot supply a user ID. The target is resolved from the proof.

The component's `public` function visibility means callable by the host app;
it is not automatically a public root application endpoint. Do not re-export
an arbitrary-user revocation endpoint without authorization. The local reference
type in the fixture represents the proposed interface; shipping would require
normal component API generation and a supported provider-facing integration.

## What the 11 new tests establish

- All pre-reset sessions for the target user stop refreshing.
- Both current and spent refresh tokens are refused, even inside the reuse grace
  window. A token rotated just before reset does not escape revocation.
- Refresh/reset overlap is tested in both invocation orders.
- Old-password login/reset overlap is tested in both invocation orders.
- The new password issues a fresh, refreshable session for the same app user.
- Another user's session remains refreshable.
- A legacy session without a generation field is revoked correctly.
- Failure after the revocation call rolls back generation, password change, and
  proof consumption together; the previous credential/session remain usable.
- An invalid recovery proof cannot revoke sessions. The component operation is
  not available as a root app function.
- Repeated revocation never restores an earlier generation.
- Real JWT signature/expiry verification demonstrates the access-token policy.

The original 37 core regression tests also run unchanged against the patched
copy. The unpatched suite still demonstrates the upstream reset gap. The full
count is 87 previous tests + 11 revocation tests + 37 repeated core regressions.

Concurrent-call tests run in `convex-test`. They establish behavior in that
runtime, not production contention/retry behavior. The intended database
guarantee comes from all issuance/refresh paths reading the same generation
record that revocation changes, inside serializable mutations. A real backend
race/retry test is still required before shipping.

## Access-token policy: a deliberate remaining window

The proof uses the existing core default of **60 seconds** for access tokens.
After reset commits:

- Old sessions cannot refresh.
- An access token already issued before reset can still pass signature/expiry
  verification until its original expiry, at most the configured access TTL.
- The test proves it is valid immediately after reset and rejected after expiry.

This is not immediate access-token invalidation. A different TTL changes the
window. If immediate denial is required, add and prove a backend authorization
check tied to session/generation claims (including subscription behavior), rather
than inferring revocation from signature verification alone. Production acceptance
of the bounded window is still an explicit policy decision.

## Live local follow-up

The [email browser proof](email/README.md) now passes on an actual local backend
with real Bento delivery. Reset rejects two old sessions and a spent refresh
token; old-password login fails; new-password login/reload retain the user ID;
reset-link replay fails. These sequential checks do not establish live concurrency
or retry behavior.

## Remaining work before integration/release

- Decide whether to propose/maintain this small core change or use an eventual
  supported upstream equivalent. No upstream PR has been submitted.
- Validate actual backend concurrency, retries, component code generation, and
  deployment schema evolution.
- Add bounded cleanup for revoked sessions and their spent-token records. They
  remain stored but unusable in this proposal. Keep generation records until no
  old sessions can survive; deleting one prematurely can revive generation-zero
  sessions. Existing upstream unbounded sign-out cleanup is unchanged.
- Prove revocation across all configured providers and authenticated password
  changes. The proposed operation is user-wide, but current integration tests
  use multiple email/password sessions, not linked GitHub/password accounts.
- Decide the access-token window versus immediate authorization checks.
- Wire the supported operation into real recovery delivery/UI and Start cookies.

## Email delivery and observability

These tests **do not call Bento or send email**. A scheduled test action captures
messages in an in-memory mailbox. Tests consume its verification/reset codes
directly; codes, passwords, and session tokens are not printed to the console.

The separate [live email proof](email/README.md) now uses Bento and its existing
delivery-status logs; see that record for inbox/browser evidence. The current
test mailbox proves lifecycle logic, not deliverability, email templates, or
browser link handling.

## Run

From `experiments/convex-auth-v2`, after the parent setup:

```sh
npm test
npm run typecheck
```

Or run the targeted proof with
`npm test -- tests/session-revocation.test.ts tests/patched-core.test.ts`.
No manual action or credential entry is needed for this stage.
