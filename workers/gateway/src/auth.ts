import type { GatewayEnv } from './env';

import { betterAuth } from 'better-auth';
import { oAuthProxy } from 'better-auth/plugins';

/**
 * A deliberately minimal better-auth instance whose only job is the
 * production-side leg of the oAuthProxy flow:
 *
 *   1. App env (preview/local/prod) starts sign-in with
 *      OAUTH_PROXY_PRODUCTION_URL pointed at this gateway, so GitHub's
 *      redirect_uri is `${GATEWAY_ORIGIN}/api/auth/callback/github`.
 *   2. GitHub redirects here; the oAuthProxy `/callback/:id` before-hook
 *      decrypts the proxy state package (OAUTH_PROXY_SECRET), exchanges the
 *      code with GitHub, fetches the user profile, encrypts it, and 302s to
 *      the originating env's `/api/auth/oauth-proxy-callback`.
 *
 * That leg never touches a database (verified against better-auth 1.6.9
 * plugin source). No `database` option is passed: better-auth then falls back
 * to its own per-instance in-memory adapter, which is what we want. (Do NOT
 * import `memoryAdapter` from "better-auth/adapters/memory" statically — its
 * module is lazily initialized in the Workers bundle and the import resolves
 * to undefined at call time: "memoryAdapter is not a function".) Keep the
 * better-auth version pinned to the app's version: the state/profile payloads
 * are symmetric-encrypted and the formats must match across both sides.
 */
export function createGatewayAuth(env: GatewayEnv) {
	return betterAuth({
		baseURL: env.GATEWAY_ORIGIN,
		basePath: '/api/auth',
		secret: env.BETTER_AUTH_SECRET ?? env.OAUTH_PROXY_SECRET,
		socialProviders: {
			github: {
				clientId: env.GITHUB_AUTH_CLIENT_ID,
				clientSecret: env.GITHUB_AUTH_CLIENT_SECRET,
			},
		},
		plugins: [
			oAuthProxy({
				productionURL: env.GATEWAY_ORIGIN,
				secret: env.OAUTH_PROXY_SECRET,
			}),
		],
		telemetry: { enabled: false },
	});
}
