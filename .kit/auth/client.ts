import type { NextRequest } from 'next/server';

import {
	adminClient,
	apiKeyClient,
	organizationClient,
	twoFactorClient,
	usernameClient,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import { getBaseUrl } from '@/kit/utils';

import { log } from '../utils';

const options = {
	fetchOptions: {
		onError: (error) => {
			log.error('better-auth client error: ', error);
		},
	},
	plugins: [
		twoFactorClient(),
		usernameClient(),
		adminClient(),
		organizationClient(),
		apiKeyClient(),
	],
} satisfies Parameters<typeof createAuthClient>[0];

export const _authClientOld = createAuthClient({
	baseURL: getBaseUrl({
		relativePath: false,
	}),
	...options,
});

export const authClient = (req?: NextRequest) => {
	const host = req?.headers.get('x-forwarded-host') || req?.headers.get('host');
	const protocol = host?.includes('localhost') ? 'http://' : 'https://';

	return createAuthClient({
		baseURL: req
			? `${protocol}${host}`
			: getBaseUrl({
					relativePath: false,
				}),
		...options,
		...(req ? { fetchOptions: { headers: req.headers } } : {}),
	});
};
