# Opaque OAuth state proof

The deployed proof protocol now stores its signed routing envelope in a SQLite
Durable Object and sends GitHub a 32-byte cryptographically random base64url
reference (43 characters). Start registers the envelope server-to-server, using
the existing per-preview signature as authentication. Registration bodies are
bounded to 4KiB and envelope size to 2KiB. The object name is a SHA-256 hash of
the reference; the reference itself is not stored as a field.

Each object represents one flow. A storage transaction reads and deletes its
payload before any provider/backend request. Concurrent callbacks have only one
winner. Expiry is checked both against storage time and the signed envelope's
original deadline; alarms clean up abandoned objects after ten minutes. Current
route keys and exact callback allowlists are rechecked on consumption. Removing
a route or rotating its key invalidates outstanding references.

PKCE, browser state cookies and the native component's atomic code claim remain
unchanged. Cancellation consumes the reference as well. If forwarding fails after
consumption, the user must restart login: this deliberately favors at-most-once
forwarding over retrying an ambiguously processed OAuth code.

The full GitHub authorization URL must fit the proof's 1,024-byte engineering
budget. This is **not** a published GitHub maximum. Payload growth stays
server-side; provider scopes and other URL parameters can still grow and are
covered by the full-URL check. The storage payload itself remains bounded.

This introduces temporary gateway storage and a registration round trip. It
therefore changes the earlier stateless proof gateway design. The existing Kino
Auth/Relay gateways and production app are untouched. Old signed state sent
directly to this proof gateway is rejected; in-flight proof logins must restart
when switching protocols.

Validation: 198 existing/new Vitest checks pass, including five new tests running
the actual gateway and SQLite Durable Objects in local workerd via Miniflare.
They cover two-route forwarding, eight concurrent callbacks, forged/unknown/old
format references, malformed callback non-consumption and signed-payload expiry.
Backend responses are mocked only in those storage tests. Gateway/Start/proof
TypeScript checks pass. Alarm cleanup is implemented but not independently
exercised by these tests. Real deployed OAuth verification passed on September 21 at 18:56 UTC (see below).

Cloudflare's public-fetch compatibility flag is enabled on the two proof Start
Workers for server-to-server registration. See
https://developers.cloudflare.com/workers/runtime-apis/fetch/

The new Durable Object migration/binding belongs only to
`kino-v2-gateway-proof-c318c09d`. Proof teardown must also account for this temporary
namespace; expired payloads are deleted by alarms. No new root workspace
dependencies or Convex schema migrations are needed.

Deployed verification (September 21): concurrent alpha/beta cancellation routes,
unknown references, signed beta registration carrying alpha's native state,
callback replay, browser state cookie, CSRF refusal and missing browser state all
pass. Actual alpha authorization URL: 365 ASCII characters, state: 43 characters.

Worker versions:
- Gateway: `15e1f14a-6e8b-4cab-a17b-5753cabfcebe`
- Alpha: `5240520d-754a-4878-9ae2-6c19c0966a34`
- Beta: `96f88fc3-524b-4fe2-8d50-a5257cdff7a1`

The initial app deployment exposed a Workers API incompatibility: fetch rejects
`redirect: 'error'`. Registration now uses `manual` and rejects non-successful
responses; no registration redirect is followed. Temporary stage diagnostics
were removed. The deployed checks above ran after this correction.


Final real-browser verification: the fresh browser began signed out of GitHub.
The user completed login; alpha and beta then returned through the gateway with
43-character references and authorization URLs below the enforced budget.
The runner synchronized both callbacks and confirmed independent users/cookies,
private SSR and reload, cross-preview ticket/JWT rejection, consumed-reference
replay rejection, and mutation/logout isolation. All six check groups passed.
Evidence: [results-two-preview-oauth.json](../cloud/results-two-preview-oauth.json).
The browser closed after success. No production rollout occurred.
