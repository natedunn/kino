import { vercel } from '@t3-oss/env-core/presets-zod';
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
	extends: [vercel()],
	client: {
		NEXT_PUBLIC_KEY: z.string().optional(),
		NEXT_PUBLIC_NODE_ENV: z.enum(['development', 'production']),
	},
	runtimeEnv: {
		NEXT_PUBLIC_KEY: process.env.NEXT_PUBLIC_KEY,
		NEXT_PUBLIC_NODE_ENV: process.env.NODE_ENV,
	},
	isServer: typeof window === 'undefined',
});
