import { zid } from 'convex-helpers/server/zod4';
import z from 'zod';

import { SHARED_SCHEMA } from './_shared';

export const projectProfileSchema = z.object({
	...SHARED_SCHEMA('project'),
	profileId: zid('profile'),
	projectId: zid('project'),
	role: z.enum(['admin', 'member']),
});
