import { z } from 'zod';

import { zid } from '@/_modules/zod4';

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
