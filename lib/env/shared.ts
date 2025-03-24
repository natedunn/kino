import { vercel } from '@t3-oss/env-core/presets-zod';
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
	extends: [vercel()],
	shared: {
		NEXT_PUBLIC_ROOT_DOMAIN: z.string(),
		NODE_ENV: z.enum(['development', 'production']).default('production'),
	},
	runtimeEnv: {
		NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
		NODE_ENV: process.env.NODE_ENV,
	},
	isServer: typeof window === 'undefined',
});
