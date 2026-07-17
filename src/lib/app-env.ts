export type AppEnvironment = 'local' | 'preview' | 'production';

const PRODUCTION_HOSTNAMES = new Set(['usekino.com', 'www.usekino.com']);

function normalizeHostname(hostname: string) {
	return hostname
		.trim()
		.toLowerCase()
		.replace(/^\[|\]$/g, '');
}

export function isLocalAppHostname(hostname: string) {
	const normalized = normalizeHostname(hostname);

	return (
		normalized === 'localhost' ||
		normalized === '127.0.0.1' ||
		normalized === '::1' ||
		normalized.endsWith('.localhost')
	);
}

export function inferAppEnvironment({
	hostname,
	isDev = false,
}: {
	hostname: string;
	isDev?: boolean;
}): AppEnvironment {
	const normalized = normalizeHostname(hostname);

	if (isDev || isLocalAppHostname(normalized)) {
		return 'local';
	}

	if (PRODUCTION_HOSTNAMES.has(normalized)) {
		return 'production';
	}

	return 'preview';
}

export function getFaviconHref(appEnvironment: AppEnvironment) {
	return `/favicons/kino-${appEnvironment}.svg?v=2`;
}
