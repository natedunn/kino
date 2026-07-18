
import { getAuthConfigProvider } from 'kitcn/auth/config';

import { getJwksEnv } from '../lib/get-env';
import type { AuthConfig } from 'convex/server';

export default {
	providers: [getAuthConfigProvider({ jwks: getJwksEnv() })],
} satisfies AuthConfig;
