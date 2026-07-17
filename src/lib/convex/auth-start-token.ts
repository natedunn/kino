import { getRequestHeaders } from '@tanstack/react-start/server';

const TRAILING_SLASH_RE = /\/$/;

function resolveConvexTokenUrl(siteUrl: string) {
	const baseUrl = siteUrl.replace(TRAILING_SLASH_RE, '');
	return `${baseUrl}/api/auth/convex/token`;
}

export async function getServerAuthToken() {
	const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL;

	if (!convexSiteUrl) {
		throw new Error('VITE_CONVEX_SITE_URL is required for auth SSR.');
	}

	const headers = new Headers(getRequestHeaders());
	headers.delete('content-length');
	headers.delete('transfer-encoding');
	headers.set('accept-encoding', 'identity');

	const response = await fetch(resolveConvexTokenUrl(convexSiteUrl), {
		headers,
	});

	if (!response.ok) {
		return null;
	}

	const data = (await response.json().catch(() => null)) as {
		token?: string | null;
	} | null;

	return data?.token ?? null;
}
