const trimTrailingSlash = (url: string) => url.replace(/\/+$/, '');

const readEnvUrl = (value: string | undefined) => {
	if (!value) {
		return undefined;
	}

	return trimTrailingSlash(value);
};

const getEnv = (): Record<string, string | undefined> => {
	if (typeof process !== 'undefined' && process.env) {
		return process.env as Record<string, string | undefined>;
	}
	return {};
};

export const getServerBaseUrl = () => {
	const env = getEnv();
	return readEnvUrl(env.PORTLESS_URL) ?? readEnvUrl(env.SITE_URL) ?? 'http://localhost:3000';
};

export const getAuthClientBaseUrl = () => {
	if (typeof window !== 'undefined') {
		return trimTrailingSlash(window.location.origin);
	}

	return getServerBaseUrl();
};

export const getTrustedOrigins = () => {
	const env = getEnv();
	return Array.from(
		new Set(
			[
				readEnvUrl(env.PORTLESS_URL),
				readEnvUrl(env.SITE_URL),
				getServerBaseUrl(),
				'https://usekino.com',
			].filter((value): value is string => Boolean(value))
		)
	);
};
