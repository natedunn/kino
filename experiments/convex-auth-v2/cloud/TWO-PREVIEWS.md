> Protocol update: see [opaque state references](../gateway/OPAQUE-STATE.md). The new protocol passed the full real-login runner on September 21 at 18:56 UTC; results-two-preview-oauth.json now records that run.

# Two previews behind one OAuth gateway

Disposable proof resources, separate from Kino's normal app and gateways:

| Target | Start app | Convex backend | Route ID |
| --- | --- | --- | --- |
| Alpha | `kino-auth-v2-proof-c318c09d.hello-fc8.workers.dev` | `graceful-elephant-103` | `c318c09d-alpha` |
| Beta | `kino-auth-v2-proof-beta-c318c09d.hello-fc8.workers.dev` | `cautious-oriole-896` | `c318c09d-beta` |

Both use `https://kino-v2-gateway-proof-c318c09d.hello-fc8.workers.dev/oauth/github/callback`
and the temporary **Kino Convex v2 Proof** GitHub registration. Its settings did
not change. Each backend has its own signing key/JWKS, each app has its own routing
key and host-only cookies, and the gateway registry contains two exact mappings.
Alpha's route/key was preserved when beta was added.

Beta Worker version: `10cc2d38-15f0-4c0f-9034-bdd1be7e3ec1` (before secret upload).
Beta deployment metadata and expiry: [deployment.json](../cloud-beta/deployment.json).
Both preview backends have explicit expirations; Workers require manual teardown.

## Evidence

Live negative checks pass; [results](results-two-preview-negative.json):

- Both backends advertise the same gateway callback and PKCE S256.
- Changing the routing key ID without a valid signature is rejected.
- Even a valid beta-key signature around alpha's original OAuth state cannot
  claim it in beta's backend; alpha's original flow remains usable.
- Concurrent cancellation callbacks return to the correct app origins.
- Replaying either consumed callback is rejected.

**Real concurrent GitHub OAuth passed.** [Results](results-two-preview-oauth.json)
record both native callbacks released together, cross-preview ticket/JWT rejection,
independent users/cookies, SSR/reload, and mutation/logout isolation.

The real-flow runner first creates both authorization requests and browser state
cookies. It holds alpha's real GitHub return, completes beta's consent, then releases
both native callback requests together. A second Chromium DevTools Fetch barrier holds the
app return tickets so each *unconsumed* ticket can be tried against the opposite
backend. Those requests use isolated Node fetch calls so their cookie-clearing
responses cannot destroy the genuine browser flow. The original native callbacks
then continue, proving rejection did not consume the legitimate tickets.

Further assertions cover independent backend user IDs for the same GitHub account,
host-only Secure/HttpOnly cookies, private SSR/reload, cross-backend JWT rejection,
gateway replay refusal, independent counters and logout isolation. No callback URL,
state, token, raw provider identity or credential is written into the results.
Chromium DevTools interception changes timing only: it does not mock, rewrite or reissue the
successful OAuth requests. The same GitHub identity is intentionally used in both
previews; this is environment isolation, not a different-GitHub-user linking test.

## Reproduce

From the parent experiment:

```sh
node scripts/two-preview-negative.mjs
PROOF_PLAYWRIGHT=/absolute/path/to/playwright node scripts/two-preview-oauth.mjs
```

The visible browser needs human GitHub authentication/consent. It opens the next
preview automatically and closes after assertions complete. Inspect the runner
result rather than treating browser closure alone as success.

Beta backend is derived from the same source without modifying the local proof:

```sh
PROOF_TARGET=beta node cloud/prepare.mjs
cd cloud-beta
node ../node_modules/convex/bin/main.js deploy --env-file .env.deploy.local --typecheck enable
```

Beta resolves the parent dependencies through an ignored `node_modules` symlink.
It has a scoped deployment key and separately generated signing material in ignored
mode-0600 files. Do not run `cloud/configure.mjs` to update beta: that older setup
routine rotates alpha's keys and overwrites the registry with its single target.
The current ignored `cloud/.env.routes.local.json` contains **both** routes.

From `start/`, build beta into its own output folder:

```sh
PROOF_CLOUD=1 PROOF_TARGET=beta \
VITE_PROOF_CONVEX_URL=https://cautious-oriole-896.convex.cloud \
VITE_PROOF_APP_ORIGIN=https://kino-auth-v2-proof-beta-c318c09d.hello-fc8.workers.dev \
VITE_PROOF_ROUTE_ID=c318c09d-beta \
node ../node_modules/vite/bin/vite.js build --config vite.cloudflare.config.ts
node ../node_modules/@cloudflare/vite-plugin/node_modules/wrangler/bin/wrangler.js deploy --config dist-cloudflare-beta/server/wrangler.json
node ../node_modules/@cloudflare/vite-plugin/node_modules/wrangler/bin/wrangler.js secret bulk ../cloud-beta/.env.routing.local.json --config dist-cloudflare-beta/server/wrangler.json
```

Registry updates use `gateway/wrangler.preview.jsonc` and the two-route secret
file. Never deploy these proof routes to Kino's shared gateway implicitly.

## Limits and cleanup

Automatic preview registration/removal, overlapping routing-key rotation, CI
integration, local tunnel sharing and production rollout are still open. This
proof uses two static exact entries, not a production lifecycle service.

After proof teardown, remove both Start Workers, the proof gateway Worker and both
Convex previews/scoped keys (or let the backends expire). Preserve sanitized
results; remove ignored credentials. Keep Kino Auth/Relay registrations and normal
Kino Workers untouched. The temporary OAuth app can be deleted after all proofs.

## Runner correction

The initial runner used Playwright `route()`, which did not intercept every hop
of GitHub's automatic redirect chain. Beta completed login while alpha remained
paused, so that attempt did not establish concurrency. The corrected runner uses
Chromium DevTools `Fetch.requestPaused`/`continueRequest` for both gateway and app
callback hops. The complete synchronized run then passed.

The existing test browser's GitHub session was reused for the corrected run, so
Nate did not need to authenticate again. Only GitHub cookies were temporarily
saved in an ignored mode-0600 file; the file was deleted when the run completed.
No proof access/refresh tokens were included in that saved session.
