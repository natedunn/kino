import type { AuthConfig } from 'convex/server';

import { convexAuthProvider } from '@convex-dev/auth/server';

// Convex Auth 2.0 access tokens are signed with the deployment's own key.
export default {
	providers: [convexAuthProvider()],
} satisfies AuthConfig;
