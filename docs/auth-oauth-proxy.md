# Auth OAuth Proxy Notes

Last updated: May 25, 2026.

> **Superseded (June 2026):** the prod-anchored proxy flow described here is
> being replaced by per-tier gateway Workers and split dev/prod GitHub
> registrations ("Kino Auth" OAuth apps + "Kino Relay" GitHub Apps). See
> `docs/github-environments.md` for the current architecture and
> `docs/gateway-setup-checklist.md` for setup. These notes remain accurate
> for the transition period while production still anchors the proxy leg.
> Note: env var names referenced below (`GITHUB_CLIENT_*`) are now
> `GITHUB_AUTH_CLIENT_*`.

## Current Problem

Kino uses Kitcn, TanStack Start, Convex, Better Auth, and the Better Auth OAuth proxy plugin. Preview deployments should be able to authenticate with GitHub without creating a new GitHub OAuth app for every preview URL.

The intended OAuth shape is:

1. A preview app starts sign-in from its own Worker URL.
2. GitHub uses the single registered callback URL on production: `https://usekino.com/api/auth/callback/github`.
3. Production decrypts the Better Auth OAuth proxy state and redirects back to the preview app's `/api/auth/oauth-proxy-callback`.
4. The preview app creates its own session cookies and redirects to the original callback page.

The observed broken behavior was:

- Preview `/auth` could click GitHub sign-in, but eventually returned to `/auth` unauthenticated.
- Convex logs showed `GET /api/auth/oauth-proxy-callback` returning `302`, plus `Failed to clean up OAuth state` warnings.
- Convex logs also showed user/session create/update work happening, which means the OAuth provider exchange was not the only issue.
- Cloudflare Worker logs for preview were often empty because the TanStack route proxies auth work to the Convex site URL through Kitcn.

## Important Diagnosis

The single production GitHub `redirect_uri` is correct. We do not want one GitHub OAuth app per preview.

The critical production dependency is that `usekino.com` is part of the preview auth flow. Because GitHub redirects to production first, production must run compatible OAuth proxy callback code. Production may skip the proxy only for its own first-party `/api/auth/sign-in/social` request; production callbacks must still process preview proxy state and forward the encrypted profile payload back to the preview.

`origin/main` still had this broad production-only bypass in `src/lib/convex/auth-server.ts`:

```ts
headers.set('x-skip-oauth-proxy', 'true');
```

That bypass is incompatible with preview OAuth proxy auth when applied to callbacks. It makes production treat the GitHub callback as a normal production sign-in instead of the proxy leg for a preview. Keep any production bypass narrowly scoped to the first-party production social sign-in request.

## Changes In PR #14

PR: https://github.com/natedunn/kino/pull/14

The PR currently contains several auth and SSR fixes.

Auth-related changes:

- Removed the broad production-origin `x-skip-oauth-proxy` bypass.
- Added redirect rewriting for Convex-site auth redirects so `/api/auth/*` redirects stay on the current app origin.
- Preserved multiple `Set-Cookie` headers when rewriting redirect responses.
- Added Better Auth forwarded-host handling before `oAuthProxy`, using Kitcn's forwarded headers so Convex can infer the original Worker host instead of only seeing the Convex site URL.
- Added optional env overrides:
  - `OAUTH_PROXY_CURRENT_URL`
  - `OAUTH_PROXY_PRODUCTION_URL`
- Kept `OAUTH_PROXY_PRODUCTION_URL` fallback as `SITE_URL` so production still uses the registered GitHub callback by default.
- Allowed local HTTP auth cookies by setting `advanced.useSecureCookies` based on `SITE_URL`.
- Added loopback trusted origins/hosts for local dev.

SSR/data-loading changes:

- Reintroduced server-side data loading for selected high-value pages.
- Added reusable server auth/query helpers.
- Added safer route error handling for transient TanStack Query `CancelledError` cases.

## Environment Requirements

These values must be coherent across prod and preview:

- `OAUTH_PROXY_SECRET` must be shared by all deployments that participate in the proxy flow.
- Production must have the GitHub OAuth client configured for `https://usekino.com/api/auth/callback/github`.
- Preview must trust its Worker origin. The current code allows Cloudflare preview patterns through `CLOUDFLARE_WORKER_NAME`.
- Production must run the OAuth proxy-compatible code. Preview auth cannot fully work if only preview has this PR deployed.

Optional but useful:

- Set `OAUTH_PROXY_PRODUCTION_URL=https://usekino.com` explicitly in all deployments.
- Use `OAUTH_PROXY_CURRENT_URL` only as an escape hatch if forwarded-host inference fails.

## Local Portless Dev

Portless worktree URLs should use the same OAuth proxy path as previews. Do not add one GitHub callback URL per worktree.

Add this to local development env, using the same proxy secret configured on `usekino.com` and preview deployments:

```sh
OAUTH_PROXY_SECRET=<shared-usekino-oauth-proxy-secret>
```

The auth handler runs on the Convex site deployment, so the same values must also be set on the Convex dev deployment. Local `.env`/`.env.local` alone is not enough:

```sh
npx convex env set OAUTH_PROXY_SECRET '<shared-usekino-oauth-proxy-secret>'
npx convex env set OAUTH_PROXY_PRODUCTION_URL https://usekino.com
```

`OAUTH_PROXY_PRODUCTION_URL` defaults to `https://usekino.com` when `SITE_URL` is loopback, so local Portless dev does not need to set it. It can still be set explicitly if needed:

```sh
OAUTH_PROXY_PRODUCTION_URL=https://usekino.com
```

Do not set `OAUTH_PROXY_CURRENT_URL` for normal Portless dev. The current URL is inferred from the trusted forwarded request host, which lets multiple worktrees use different `*.kino.localhost:1355` hosts at the same time.

Expected local Portless shape:

1. The app starts sign-in from `https://<worktree>.kino.localhost:1355`.
2. GitHub receives `redirect_uri=https://usekino.com/api/auth/callback/github`.
3. `usekino.com` handles the provider callback and redirects back to `https://<worktree>.kino.localhost:1355/api/auth/oauth-proxy-callback`.
4. The local Portless origin sets its own Better Auth session cookies and returns to `/auth` or the requested callback URL.

Because GitHub calls back to `usekino.com`, production must be deployed with the redirect rewrite that permits trusted local `.localhost` OAuth proxy callback origins. Without that production code, GitHub will succeed but the browser can remain on `usekino.com` or a Convex site URL instead of completing auth in the local worktree.

## Verification Plan

After merging/deploying to production:

1. Confirm production deploy completed.
2. Confirm preview deploy is also on the same PR/main code.
3. Open a clean browser session or clear relevant `better-auth.*` cookies for both preview and `usekino.com`.
4. Visit the preview `/auth`.
5. Click GitHub sign-in.
6. Confirm GitHub sends the browser to `https://usekino.com/api/auth/callback/github`.
7. Confirm production redirects to the preview `/api/auth/oauth-proxy-callback`.
8. Confirm preview sets `better-auth.session_token` and `better-auth.convex_jwt` cookies.
9. Confirm `/api/auth/get-session` on the preview returns an authenticated session.
10. Confirm refreshing an authenticated app route does not show `There was an error`.

Useful diagnostics:

```sh
curl -s -D /tmp/kino-signin.headers -o /tmp/kino-signin.body \
  'https://<preview-host>/api/auth/sign-in/social' \
  -H 'content-type: application/json' \
  -H 'origin: https://<preview-host>' \
  --data '{"provider":"github","callbackURL":"https://<preview-host>/auth"}'
```

Expected:

- Response is `200`.
- `location` and JSON body point to GitHub.
- GitHub `redirect_uri` is `https://usekino.com/api/auth/callback/github`.
- `state` is long/encrypted, not the short raw Better Auth state.
- `set-cookie` is scoped to the preview host.

## If It Still Fails

Check these in order:

1. Production is actually deployed with the PR code.
2. `OAUTH_PROXY_SECRET` matches between production and preview.
3. Production callback logs show it redirects to preview `/api/auth/oauth-proxy-callback`, not only creates a production session.
4. Preview callback response includes separate `Set-Cookie` headers for session/JWT cookies.
5. Browser cookies are not blocked for the preview Worker domain.
6. `SITE_URL`, `TRUSTED_ORIGINS`, and `CLOUDFLARE_WORKER_NAME` match the deployment shape.
7. GitHub OAuth app callback remains exactly `https://usekino.com/api/auth/callback/github`.

## Next Work

- Merge/deploy production with the OAuth proxy-compatible auth route.
- Retest preview auth end-to-end.
- Once preview auth works, retest production auth and hard refreshes on authenticated routes.
- If route refresh errors remain, continue the SSR/data-loading work separately from OAuth.
- Consider adding a small auth-debug endpoint or structured auth logs gated to non-production/debug mode, so future OAuth proxy issues can show the callback origin, rewritten redirect target, and cookie names without leaking secrets.
