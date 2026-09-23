import { env } from './_generated/server';

export function emailCredentials() {
	const {
		BENTO_PUBLISHABLE_KEY: publishableKey,
		BENTO_SECRET_KEY: secretKey,
		BENTO_SITE_UUID: siteUuid,
		BENTO_FROM: from,
	} = env;
	if (!publishableKey || !secretKey || !siteUuid || !from) return null;
	return { publishableKey, secretKey, siteUuid, from };
}
