# Verified email/password lifecycle proof

**Follow-up:** a separate [session-revocation proposal](SESSION-REVOCATION.md)
now passes local tests. The original upstream gap below remains the baseline;
the patch is not part of official v2 or deployed to Kino. The separate
[live local email proof](email/README.md) now installs it and uses Bento.

Recorded September 20, 2026. Uses the same pinned official source as the
[parent harness](README.md). No application or live proof deployment was changed.

## Result

**14 lifecycle tests pass; TypeScript passes.** Verification and password
replacement are feasible through the current provider/component interfaces.
**Recovery is incomplete: password reset does not revoke existing sessions.**

The passing gap test asserts the observed unwanted behavior: an old refresh
token still rotates successfully after password replacement. This is a measured
limitation of the composed proof, not a completed security requirement.

## What ran

The test-only provider under `tests/email-fixture/` uses:

- App-owned users, verified status, challenge hashes, and challenge generations.
- Official `setupCore` / `bindProvider`, `signUpWithoutSession`, and
  `completeSignIn`; no replacement session/token implementation.
- The official password component, actual Argon2 WASM hashing, and its limiter.
- An app-level official rate-limiter component for email requests and login.
- A scheduled internal action replacing the external email transport with a
  process-local mailbox. No actual email was sent.
- Real core/password component functions inside `convex-test` and ephemeral RSA
  keys. No copied password hashing or forged success responses.

A read-only test inspection function is registered inside the in-memory core
component to assert account/session counts. It is not an upstream source edit,
exported app API, or proposed way for production code to access private tables.
Positive session/account count assertions ensure inspections target the component,
not similarly named nonexistent app tables.

## Behavior established

1. Signup creates one app user/account and a password, but no session.
2. Password login rejects an unverified account.
3. Verification completion marks the account verified and issues a core session;
   later login resolves the same user.
4. Challenge tables contain hashes rather than raw codes. Public initiation
   responses contain no challenge or session token. The raw code travels through
   the scheduled email job and test mailbox, as an email credential would.
5. Wrong, expired, already consumed, or wrong-purpose codes are rejected.
6. Resend supersedes earlier challenges using a per-user/purpose generation.
7. Two simultaneous verification calls yield one session in the test runtime.
   This is not a deployment load/OCC stress test.
8. A failing core sign-in callback rolls back verified status, challenge
   consumption, and session creation. The same proof succeeds after removing
   the injected failure.
9. Invalid initial passwords roll back app user, core account, and delivery work.
10. Repeated normalized signup cannot replace an existing password or create a
    second app user.
11. Unknown and unverified recovery requests get a generic acknowledgment and
    send no reset email. Known/unknown requests have matching response shapes.
12. Successful reset invalidates the old password, accepts the replacement, and
    consumes the reset code. Rejected replacements leave the code usable and the
    old credential intact.
13. Reset resends supersede old reset codes; reset codes expire too.
14. Rate-limit failures are returned rather than thrown so the normal rejection
    path does not roll back consumed quota. Repeated failed login/email requests
    are limited in the tested paths.

## Decisions this exposes

### Existing sessions after recovery: still an open gate

The pinned password recipe explicitly marks session revocation as needing core
support. Its `setPassword` operation updates credentials; core sessions remain.
The proof deliberately does not patch private core tables or invent parallel
refresh-token ownership to hide this gap.

Before shipping recovery, decide and prove:

- Whether reset signs out every existing session (recommended requirement to
  evaluate), and whether authenticated password changes offer the same behavior.
- A supported way to revoke a user's core sessions, including previously spent
  refresh tokens and races with simultaneous refresh/reset.
- How long already issued access tokens may remain usable. Revoking refresh
  tokens alone does not immediately invalidate signed access tokens.
- Whether live app authorization checks are required for immediate denial.

Possible work to investigate next is a small upstream-compatible core API for
user-wide revocation. That would be a separate implementation/proof decision;
none was added here. App-owned authorization remains a separate responsibility.

### Other boundaries before a real email flow

- The fixture is not deployed and is not a production auth module. It omits
  production email delivery/retry, localized templates, browser forms, Start
  cookies, link origin validation, and end-to-end delivery evidence.
- Tests pass raw codes from the mailbox to completion; they do not test email
  link navigation or a mail scanner consuming a link. Completion should be an
  explicit action, not an unconditional side effect of a link GET.
- Email normalization is a provisional trim/lowercase rule with a simple format
  check. International addresses, email changes, and cross-provider identity
  linking still need an explicit policy.
- Challenge/account cleanup and bounded retention are not implemented.
- Matching responses do not establish timing resistance to account enumeration.
  The proof does not claim full abuse resistance: trusted per-IP/global limits,
  delivery costs, initial signup validation failures, and distributed attacks
  need separate coverage.
- Existing-account signup never silently replaces credentials. Initial password
  setup/verification UX still needs review for unsolicited signup/pre-registration
  scenarios; inbox possession alone should not surprise a recipient into accepting
  credentials chosen by another person.
- The test-only `rejectSignIn` flag is fault injection for rollback tests, not a
  proposed field or client-controlled option in the real user model.

## Reproduce

From `experiments/convex-auth-v2`, after the parent setup instructions:

```sh
npm test -- tests/email-lifecycle.test.ts
npm run typecheck
```

No manual task is needed from Nate for this automated stage. A real verification
and recovery email check will be requested once delivery and the reset-session
policy are implemented in a runnable integration.
