import type { GatewayEnv } from './env';

import legacy from './legacy';
import { handleNativeOAuth } from './native-oauth';
import { parseNativeRoutes } from './native-routing';

export { OAuthState } from './native-state-object';

export default {
	async fetch(request: Request, env: GatewayEnv, ctx: ExecutionContext) {
		const url = new URL(request.url);
		const routes = parseNativeRoutes(env.NATIVE_GITHUB_ROUTES);
		if (url.pathname === '/' || url.pathname === '/health') {
			const response = await legacy.fetch(request, env, ctx);
			const health: {
				nativeGithub: { enabled: boolean };
			} = await response.json();
			health.nativeGithub.enabled = !!routes && !!env.OAUTH_STATES;
			return Response.json(health, {
				status: 200,
				headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
			});
		}
		if (url.pathname === '/oauth/state' || url.pathname === '/oauth/github/callback') {
			if (!routes || !env.OAUTH_STATES)
				return new Response('Native GitHub is not configured', {
					status: 503,
					headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
				});
			return handleNativeOAuth(request, env, routes);
		}
		return legacy.fetch(request, env, ctx);
	},
} satisfies ExportedHandler<GatewayEnv>;
