import z from 'zod';

import { zid } from '@/_modules/zod4';

import { SHARED_SCHEMA } from './_shared';

export const projectProfileSchema = z.object({
	...SHARED_SCHEMA('project'),
	profileId: zid('profile'),
	projectId: zid('project'),
	role: z.enum(['admin', 'member']),
});
