import { zid } from 'convex-helpers/server/zod4';
import * as z from 'zod';

import { SHARED_SCHEMA } from './_shared';
import { emoteContentSchema } from './emote.shared';

// Reactions on update comments
export const updateCommentEmoteSchema = z.object({
	...SHARED_SCHEMA('updateCommentEmote'),
	updateId: zid('update'),
	updateCommentId: zid('updateComment'),
	authorProfileId: zid('profile'),
	content: emoteContentSchema,
});

export type UpdateCommentEmote = z.infer<typeof updateCommentEmoteSchema>;
