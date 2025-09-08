import { zid } from 'convex-helpers/server/zod';
import z from 'zod';

import { SHARED_SCHEMA } from './_shared';

export const projectUser = z.object({
	...SHARED_SCHEMA('project'),
	userId: zid('user'),
	projectId: zid('project'),
	role: z.enum(['admin', 'owner', 'member']),
});
