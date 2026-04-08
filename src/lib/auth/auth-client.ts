import { convexClient } from '@convex-dev/better-auth/client/plugins';
import { adminClient, organizationClient, usernameClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import { getAuthClientBaseUrl } from '@/lib/auth/runtime-url';

export const authClient = createAuthClient({
	baseURL: getAuthClientBaseUrl(),
	plugins: [
		//
		usernameClient(),
		adminClient(),
		organizationClient(),
		convexClient(),
	],
});
