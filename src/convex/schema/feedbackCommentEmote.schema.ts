import { zid } from 'convex-helpers/server/zod4';
import * as z from 'zod';

import { SHARED_SCHEMA } from './_shared';
import { emoteContentSchema } from './emote.shared';

export const feedbackCommentEmoteSchema = z.object({
	...SHARED_SCHEMA('feedbackCommentEmote'),
	authorProfileId: zid('profile'),
	feedbackId: zid('feedback'),
	feedbackCommentId: zid('feedbackComment'),
	content: emoteContentSchema,
});

export type FeedbackCommentEmote = z.infer<typeof feedbackCommentEmoteSchema>;
