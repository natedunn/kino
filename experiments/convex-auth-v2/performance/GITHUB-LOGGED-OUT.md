# GitHub logged-out login failure — isolated trigger

September 21 production baseline attempt: user completed the GitHub sign-in step
and saw GitHub's Server Error page at `https://github.com/session`. Inspection of
the dedicated benchmark browser confirmed that URL/title and that GitHub's
`logged_in` cookie was not `yes`. No successful production callback timing has
been recorded. The original runner did not capture GitHub's response status or
request ID, so the screenshot's 500 page is the evidence for the server error.

User reports this also happened previously in the stable app when not already
signed into GitHub, whereas beginning OAuth with a GitHub session worked.
This is a reported correlation, not an established root cause.

Fresh initiation probes returned valid GitHub authorization URLs for both stacks:

| Property | Current production | Native proof |
|---|---:|---:|
| Authorization URL length | 2200 | 634 |
| State length | 1906 | 312 |
| GitHub initial response | 302 to login | 302 to login |
| Scope | read:user user:email | read:user user:email |
| PKCE method | S256 | S256 |

The large encrypted proxy state/return URL is a candidate to investigate, not
proof of a size limit or malformed request. Do not remove state or PKCE to
work around this. Broad upstream searches did not find a verified matching
explanation. Callback code-exchange failure has not been observed in this attempt;
the visible failure remains on GitHub's own login endpoint.

Next check opened: native proof OAuth in the same still-logged-out GitHub browser
context. This requires user sign-in. It captures only GitHub `/session` status
and request ID, not credentials or response bodies. If it succeeds, retry
production with the resulting GitHub session and record that baseline explicitly
as an already-signed-into-GitHub flow. Different OAuth registrations and a
sequential retry mean even a successful comparison will not alone isolate causality.

Migration acceptance must include both initially logged-out and already-logged-in
GitHub states. Existing successful OAuth tests alone do not close this regression.

## Observed outcome

The native logged-out test passed. GitHub `/session` returned HTTP 302 and the
browser reached the native private counter. Sanitized evidence is in
[logged-out-github.json](logged-out-github.json). The automatic production retry
then passed with GitHub already signed in, and both stacks completed five
protected reloads.

This reproduces the user's reported distinction in this session: production's
initial logged-out attempt failed, native's subsequent logged-out attempt passed,
and production's already-logged-in retry passed. It does **not** isolate the root
cause: OAuth registrations differ and attempts were sequential. Request size,
GitHub transient behavior, or another login-path difference remain unproven.
No production configuration was changed. Do not describe the long-state
hypothesis as confirmed or the migration as a proven fix for this incident.

## Controlled same-app experiment: long-state trigger isolated

The subsequent three-case test held the production OAuth client, redirect URI,
scopes and PKCE challenge constant. Every case began in a fresh signed-out browser
context. Only the state parameter changed. Gateway callbacks were intercepted in
the diagnostic browser before reaching Kino; no callback validation was bypassed
in application code and the synthetic states could not create Kino sessions.

| State variant | State characters | Authorization URL characters | GitHub POST /session | Outcome |
|---|---:|---:|---|---|
| Original encrypted proxy state | 1906 | 2200 | 500 | Failed before 2FA |
| Short random state | 48 | 342 | 302 | GitHub 2FA and OAuth return succeeded |
| Random state of original length | 1906 | 2200 | 500 | Failed before 2FA |

[Raw sanitized evidence](github-session-diagnostic.json) includes GitHub request
IDs for all three attempts. The user independently confirmed no verification-code
step for either long-state failure, and success for the short-state attempt.

**Conclusion:** the observed crash is in GitHub's signed-out login handling of
this long authorization request, triggered by the large state our current OAuth
proxy emits. It is not a Kino callback/code-exchange exception: neither failing
attempt reaches that stage. The successful short-state case uses the same OAuth
registration and PKCE, while a random long state also fails, isolating request
length from the encrypted payload's particular contents in this experiment.

This does not establish an exact limit or whether GitHub's internal limit applies
to state, the full authorization URL, or its nested login return URL; those lengths
co-vary here. GitHub's documented authorization parameters describe state as an
unguessable random string without stating a length cap:
https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
GitHub's internal exception would require their logs/support to identify. The
500 location and practical trigger are now established for the tested setup.

**Remediation ownership:** GitHub owns the failing login handler; Kino controls
the size of the request that triggers it. A shorter valid state design is the
practical app-side mitigation. Never truncate the current encrypted payload or
remove state/PKCE: shorten it by changing the protocol/storage design while
preserving expiry, browser binding and replay checks. The native proof uses a
312-character signed routing state and has already passed the logged-out flow.
No production fix has been deployed. Keep the logged-out test as an acceptance
gate when the native flow is integrated into the actual app.

## External research — September 21, 2026

Searched public web results for GitHub `/session` 500, logged-out OAuth failure,
long state, long authorization URLs, `return_to`, and Better Auth proxy issues.
Also searched Better Auth's issue/PR index. No independent report matching all
of our observed conditions, GitHub-confirmed numerical limit, or verified
Better Auth release fix was found. This is a search result, not proof that no
such report exists.

Relevant primary sources:

- [GitHub authorization parameters](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps):
  describes state as an unguessable random string, with no stated length cap.
  Does not document our `/session` failure or justify claiming a 2,048-character
  GitHub limit.
- [n8n issue 30853](https://github.com/n8n-io/n8n/issues/30853), opened May 21,
  2026: independent report of encrypted state payloads exceeding provider limits;
  the concrete report targets LeanIX MCP and returns `invalid_request` with
  `state parameter too long`. Supports the general interoperability problem,
  not a GitHub-specific diagnosis or confirmation.
- [Better Auth OAuth Proxy documentation](https://better-auth.com/docs/plugins/oauth-proxy):
  describes the proxy protocol and shared-secret requirements. Its documented
  troubleshooting concerns state mismatch and environment configuration, not
  the provider's pre-2FA `/session` 500. No verified short-state fix was identified.
- [Better Auth issue 4953](https://github.com/better-auth/better-auth/issues/4953):
  preview/local proxy failures and incorrect return origins; does not establish
  our long-state/GitHub login failure and should not be cited as corroboration.

The strongest evidence for this specific trigger remains our controlled
same-client 500 / success / 500 experiment and GitHub response request IDs.
External sources support the general failure class, but do not independently
confirm the GitHub implementation detail. No code/config changes, upstream issue,
or support message were submitted as part of this research.

## Intermediate-length follow-up

The adaptive run and independent repeat captured these outcomes:

- 1,024 state characters / 1,318-character authorization URL: `/session` 302,
  two-factor page 200, completed OAuth return with matching state and a code.
- 1,465 state characters / 1,759-character authorization URL: `/session` 302,
  then `/sessions/two-factor/mobile` 404. Repeated with a new random state in
  a fresh context and obtained the same sequence.

Evidence: [first run](github-state-length.json) and
[repeat](github-state-length-resume.json). Both runs stopped on the unexpected
404; neither classified it as the original `/session` 500 or completed the
planned bisection. The latest two-factor 404 request ID is
`5D9B:19E022:5103:678A:6AB178BC`.

These observations show more than a single established 500 cutoff: the
intermediate size reproducibly fails later, at the GitHub two-factor page.
The exact underlying limit/mechanism remains unknown. A general assertion that
all authorization URLs below 2,048 characters work is contradicted by this
1,759-character failing case. No production changes have been made.
