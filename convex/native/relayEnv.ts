import { env } from './_generated/server';

export function getEnv() {
	return { SITE_URL: env.AUTH_APP_ORIGIN };
}
export function isTrustedOrigin(origin: string) {
	return (
		origin === new URL(env.AUTH_APP_ORIGIN).origin || origin === new URL(env.CONVEX_SITE_URL).origin
	);
}
export function getGitHubRelayEnv() {
	return {
		appId: env.GITHUB_RELAY_APP_ID,
		clientId: env.GITHUB_RELAY_CLIENT_ID,
		clientSecret: env.GITHUB_RELAY_CLIENT_SECRET,
		privateKey: env.GITHUB_RELAY_PRIVATE_KEY,
		slug: env.GITHUB_RELAY_SLUG,
		stateSecret: env.GITHUB_RELAY_STATE_SECRET,
		webhookSecret: env.GITHUB_RELAY_WEBHOOK_SECRET,
		callbackTargetUrl: env.GITHUB_RELAY_CALLBACK_TARGET_URL,
	};
}
