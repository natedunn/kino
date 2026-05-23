import { getAuthConfigProvider } from 'kitcn/auth/config';
import type { AuthConfig } from 'convex/server';
import { getJwksEnv } from '../lib/get-env';

export default {
  providers: [getAuthConfigProvider({ jwks: getJwksEnv() })],
} satisfies AuthConfig;
