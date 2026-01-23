import { zid } from 'convex-helpers/server/zod4';
import * as z from 'zod';

import { SHARED_SCHEMA } from './_shared';

export const updateCommentSchema = z.object({
	...SHARED_SCHEMA('updateComment'),
	updateId: zid('update'),
	authorProfileId: zid('profile'),
	content: z.string().min(1).max(1200),
});

export const updateCommentSelectSchema = updateCommentSchema;
export const updateCommentCreateSchema = updateCommentSchema.pick({
	updateId: true,
	content: true,
});

export type UpdateComment = z.infer<typeof updateCommentSchema>;
export type UpdateCommentSelectSchema = z.infer<typeof updateCommentSelectSchema>;
export type UpdateCommentCreateSchema = z.infer<typeof updateCommentCreateSchema>;
