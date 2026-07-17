import type { GatewayEnv } from './env';

import { isTrustedTargetUrl, timingSafeEqualString } from './env';

/**
 * Signed-state trampoline for the GitHub App (sync) install/authorize flow.
 *
 * The app envs create state with `createGitHubAppState` in
 * `convex/lib/github.ts`: `base64url(JSON payload) + "." + hex HMAC-SHA256`.
 * Payload: { v: 1, exp, nonce, targetUrl }.
 *
 * The tier GitHub App's callback URL points at
 * `${GATEWAY_ORIGIN}/github-relay/oauth-callback`. This route verifies the state
 * signature/expiry, checks the target is a trusted tier origin, and forwards
 * all GitHub query params (code, installation_id, setup_action, state) to the
 * originating env's `/api/github/callback`, which completes the connection.
 */

type GitHubAppStatePayload = {
	exp: number;
	nonce: string;
	targetUrl: string;
	v: 1;
};

function base64UrlDecode(value: string) {
	const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`;
	const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) {
		bytes[index] = binary.charCodeAt(index);
	}
	return new TextDecoder().decode(bytes);
}

async function hmacSha256Hex(secret: string, payload: string) {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ hash: 'SHA-256', name: 'HMAC' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
	return Array.from(new Uint8Array(signature))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

export async function verifyGitHubAppState(env: GatewayEnv, state: string) {
	const [encodedPayload, signature] = state.split('.');
	if (!encodedPayload || !signature) {
		throw new Error('GitHub state is malformed');
	}

	const expectedSignature = await hmacSha256Hex(env.GITHUB_RELAY_STATE_SECRET, encodedPayload);
	if (!timingSafeEqualString(expectedSignature, signature)) {
		throw new Error('GitHub state signature is invalid');
	}

	const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<GitHubAppStatePayload>;
	if (
		payload.v !== 1 ||
		typeof payload.exp !== 'number' ||
		typeof payload.nonce !== 'string' ||
		typeof payload.targetUrl !== 'string'
	) {
		throw new Error('GitHub state payload is invalid');
	}
	if (payload.exp < Date.now()) {
		throw new Error('GitHub state expired');
	}
	if (!isTrustedTargetUrl(env, payload.targetUrl)) {
		throw new Error('GitHub callback target URL is not trusted');
	}

	return payload as GitHubAppStatePayload;
}

export async function handleGitHubRelayOAuthCallback(env: GatewayEnv, request: Request) {
	const url = new URL(request.url);
	const state = url.searchParams.get('state');

	try {
		if (!state) throw new Error('GitHub callback is missing state');

		const payload = await verifyGitHubAppState(env, state);
		const target = new URL(payload.targetUrl);
		for (const [key, value] of url.searchParams.entries()) {
			target.searchParams.set(key, value);
		}

		return Response.redirect(target.toString(), 302);
	} catch (error) {
		console.warn(
			'github-app callback rejected:',
			error instanceof Error ? error.message : 'unknown error'
		);
		return new Response('Invalid GitHub callback state', { status: 400 });
	}
}
