import { convexAdapter } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { betterAuth } from 'better-auth';
import { organization, username } from 'better-auth/plugins';

import { GenericCtx } from '@/convex/_generated/server';
import { betterAuthComponent } from '@/convex/api/auth';

export const createAuth = (ctx: GenericCtx) => {
	return betterAuth({
		baseURL: process.env.VITE_BASE_URL as string,
		trustedOrigins: [
			'http://localhost:3000',
			'https://buildstory.com',
			'https://buildinpublic.club',
		],
		database: convexAdapter(ctx, betterAuthComponent),
		account: {
			accountLinking: {
				enabled: true,
			},
		},
		user: {
			deleteUser: {
				enabled: true,
			},
		},
		socialProviders: {
			github: {
				clientId: process.env.GITHUB_CLIENT_ID as string,
				clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
			},
		},
		plugins: [
			username({
				// NOTE: make sure this matches zod schema for now
				minUsernameLength: 3,
				maxUsernameLength: 20,
			}),
			organization(),
			convex(),
		],
	});
};
