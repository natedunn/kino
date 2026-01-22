import { zid } from 'convex-helpers/server/zod4';
import * as z from 'zod';

import { SHARED_SCHEMA } from './_shared';

export const updateSchema = z.object({
	...SHARED_SCHEMA('update'),
	slug: z.string(),
	title: z.string().min(1).max(200),
	content: z.string(), // HTML content
	authorProfileId: zid('profile'),
	projectId: zid('project'),
	status: z.enum(['draft', 'published']),
	publishedAt: z.number().optional(), // Timestamp for sorting published updates
	tags: z.array(z.string()).optional(),
	relatedFeedbackIds: z.array(zid('feedback')).optional(), // Can link ANY feedback, not just closed
	coverImageId: z.string().optional(), // R2 storage ID for featured image
});

export const updateSelectSchema = updateSchema;
export const updateCreateSchema = updateSchema.pick({
	title: true,
	content: true,
	projectId: true,
	tags: true,
	relatedFeedbackIds: true,
	coverImageId: true,
});

export type Update = z.infer<typeof updateSchema>;
export type UpdateSelectSchema = z.infer<typeof updateSelectSchema>;
export type UpdateCreateSchema = z.infer<typeof updateCreateSchema>;
