import { vercel } from '@t3-oss/env-core/presets-zod';
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
	extends: [vercel()],
	client: {
		NEXT_PUBLIC_KEY: z.string().optional(),
	},
	runtimeEnv: {
		NEXT_PUBLIC_KEY: process.env.NEXT_PUBLIC_KEY,
	},
	isServer: typeof window === 'undefined',
});
