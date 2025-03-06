import { toNextJsHandler } from 'better-auth/next-js';

import { auth } from '@/kit/auth';

export const { GET, POST } = toNextJsHandler(auth.handler);
