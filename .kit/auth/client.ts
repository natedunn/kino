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

export const authClient = createAuthClient({
	baseURL: getBaseUrl({
		relativePath: false,
	}),
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
});
