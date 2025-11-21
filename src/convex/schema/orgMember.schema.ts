import { zid } from 'convex-helpers/server/zod4';
import * as z from 'zod';

import { SHARED_SCHEMA } from './_shared';
import { orgSchema } from './org.schema';

export const orgMemberSchema = z.object({
	...SHARED_SCHEMA('orgMember'),
	profileId: zid('profile'),
	organizationId: z.string(),
	role: z.enum(['admin', 'editor']),
	orgVisibility: orgSchema.shape.visibility,
	orgSlug: orgSchema.shape.slug,
});

export type OrgMember = z.infer<typeof orgMemberSchema>;
