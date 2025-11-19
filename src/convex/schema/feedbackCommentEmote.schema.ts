import { zid } from 'convex-helpers/server/zod4';
import * as z from 'zod';

import { SHARED_SCHEMA } from './_shared';

export const feedbackCommentEmoteSchema = z.object({
	...SHARED_SCHEMA('feedbackCommentEmote'),
	authorProfileId: zid('profile'),
	feedbackId: zid('feedback'),
	feedbackCommentId: zid('feedbackComment'),
	content: z.enum([
		// 👍 👎 😄 ❓ 🙁 🎉 👀 ❤️ 💀 🤯
		'thumbsUp',
		'thumbsDown',
		'laugh',
		'questionMark',
		'sad',
		'tada',
		'eyes',
		'heart',
		'skull',
		'explodingHead',
	]),
});

export type FeedbackCommentEmote = z.infer<typeof feedbackCommentEmoteSchema>;
