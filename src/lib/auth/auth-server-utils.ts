import { setupFetchClient } from '@convex-dev/better-auth/react-start';

import { createAuth } from '@/convex/api/auth';

// These helpers call Convex functions using a token from
// Better Auth's cookies, if available.
export const { fetchQuery, fetchMutation, fetchAction } = await setupFetchClient(createAuth);
