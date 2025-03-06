import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
	server: {
		DATABASE_URL: z.string(),
		BETTER_AUTH_SECRET: z.string(),
		GITHUB_CLIENT_ID: z.string(),
		GITHUB_CLIENT_SECRET: z.string(),
		ADMIN_EMAIL: z.string(),
	},
	experimental__runtimeEnv: process.env,
	isServer: typeof window === 'undefined',
});
