import { zid } from 'convex-helpers/server/zod4';
import * as z from 'zod';

import { SHARED_SCHEMA } from './_shared';
import { projectSchema } from './project.schema';

export const projectMemberSchema = z.object({
	...SHARED_SCHEMA('projectMember'),
	profileId: zid('profile'),
	projectId: zid('project'),
	role: z.enum([
		'admin',
		'member',
		'editor',
		'org:admin',
		'org:editor',
		'system:admin',
		'system:editor', //
	]),
	projectVisibility: projectSchema.shape.visibility,
	projectSlug: projectSchema.shape.slug,
});

export type ProjectMember = z.infer<typeof projectMemberSchema>;
