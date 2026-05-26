# Auth OAuth Proxy Notes

Last updated: May 25, 2026.

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

The critical production dependency is that `usekino.com` is part of the preview auth flow. Because GitHub redirects to production first, production must run compatible OAuth proxy code. If production skips the OAuth proxy callback handling, it will authenticate production instead of forwarding the encrypted profile payload back to the preview.

`origin/main` still had this production-only bypass in `src/lib/convex/auth-server.ts`:

```ts
headers.set('x-skip-oauth-proxy', 'true');
```

That bypass is incompatible with preview OAuth proxy auth. It makes production treat the GitHub callback as a normal production sign-in instead of the proxy leg for a preview.

## Changes In PR #14

PR: https://github.com/natedunn/kino/pull/14

The PR currently contains several auth and SSR fixes.

Auth-related changes:

- Removed the production-origin `x-skip-oauth-proxy` bypass.
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
