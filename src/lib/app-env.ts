export type AppEnvironment = 'local' | 'preview' | 'production';

export type AppInstallMetadata = {
	manifestHref: string;
	appleTouchIconHref: string;
	themeColor: string;
	safariMaskColor: string;
};

const PRODUCTION_HOSTNAMES = new Set(['usekino.com', 'www.usekino.com']);

const APP_INSTALL_METADATA = {
	local: {
		manifestHref: '/manifests/kino-local.json',
		appleTouchIconHref: '/pwa/local/apple-touch-icon-180.png',
		themeColor: '#22C55E',
		safariMaskColor: '#22C55E',
	},
	preview: {
		manifestHref: '/manifests/kino-preview.json',
		appleTouchIconHref: '/pwa/preview/apple-touch-icon-180.png',
		themeColor: '#FACC15',
		safariMaskColor: '#FACC15',
	},
	production: {
		manifestHref: '/manifests/kino-production.json',
		appleTouchIconHref: '/pwa/production/apple-touch-icon-180.png',
		themeColor: '#0000FF',
		safariMaskColor: '#0000FF',
	},
} as const satisfies Record<AppEnvironment, AppInstallMetadata>;

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

export function getAppInstallMetadata(appEnvironment: AppEnvironment): AppInstallMetadata {
	return APP_INSTALL_METADATA[appEnvironment];
}
