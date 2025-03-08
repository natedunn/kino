import { vercel } from '@t3-oss/env-core/presets-zod';
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

import { logger } from '../../.kit/utils';

export const env = createEnv({
	extends: [vercel()],
	server: {
		DATABASE_URL: z.string(),
		BETTER_AUTH_SECRET: z.string(),
		GITHUB_CLIENT_ID: z.string(),
		GITHUB_CLIENT_SECRET: z.string(),
		ADMIN_EMAIL: z.string(),
		POLAR_ACCESS_TOKEN: z.string(),
		POLAR_WEBHOOK_SECRET: z.string(),
		NODE_ENV: z.enum(['development', 'production']).default('production'),
	},
	experimental__runtimeEnv: process.env,
	isServer: typeof window === 'undefined',
});
