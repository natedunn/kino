
import { createGatewayAuth } from './auth';
import { handleGitHubRelayOAuthCallback } from './github-relay';
import { handleGitHubWebhook, handleTargetsApi } from './hooks';
import { rewriteProxyCallbackRedirect } from './redirect-rewrite';
import type { GatewayEnv } from './env';

export default {
	async fetch(request: Request, env: GatewayEnv, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// Better Auth oAuthProxy production leg (GitHub OAuth login callback).
		if (url.pathname.startsWith('/api/auth')) {
			const response = await createGatewayAuth(env).handler(request);
			return rewriteProxyCallbackRedirect(env, response);
		}

		// GitHub App (sync) install/authorize trampoline.
		if (url.pathname === '/github-relay/oauth-callback') {
			return handleGitHubRelayOAuthCallback(env, request);
		}

		// GitHub App webhook intake + fan-out.
		if (url.pathname === '/hooks/github' && request.method === 'POST') {
			return handleGitHubWebhook(env, request, ctx);
		}

		// Webhook target registry (deploy/cleanup scripts).
		if (url.pathname === '/hooks/targets') {
			return handleTargetsApi(env, request);
		}

		if (url.pathname === '/' || url.pathname === '/health') {
			return new Response(JSON.stringify({ ok: true, service: 'kino-gateway' }), {
				headers: { 'content-type': 'application/json' },
				status: 200,
			});
		}

		return new Response('Not found', { status: 404 });
	},
} satisfies ExportedHandler<GatewayEnv>;
