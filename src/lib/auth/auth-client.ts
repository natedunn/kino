import { convexClient } from '@convex-dev/better-auth/client/plugins';
import {
	emailOTPClient,
	magicLinkClient,
	twoFactorClient,
	usernameClient,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
	plugins: [
		usernameClient(),
		magicLinkClient(),
		emailOTPClient(),
		twoFactorClient(),
		convexClient(),
	],
});
