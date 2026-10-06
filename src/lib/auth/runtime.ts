const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * In local dev, GitHub returns straight to this worktree's own loopback Convex
 * site instead of the gateway (which only reaches HTTPS backends). Null outside
 * a dev build or when the site URL is not a plain-HTTP loopback origin.
 */
export function localGithubCallbackUrl(siteUrl: string | undefined, isDev: boolean): string | null {
	if (!isDev || !siteUrl) return null;
	try {
		const url = new URL(siteUrl);
		if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname) || !url.port) return null;
		return `${url.origin}/oauth/github/callback`;
	} catch {
		return null;
	}
}

export const isNativeGithubEnabled =
	import.meta.env.VITE_NATIVE_GITHUB_ENABLED === 'true' ||
	localGithubCallbackUrl(import.meta.env.VITE_CONVEX_SITE_URL, import.meta.env.DEV) !== null;
