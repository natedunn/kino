import { zid } from 'convex-helpers/server/zod4';
import * as z from 'zod';

import { SHARED_SCHEMA } from './_shared';

export const feedbackUpvoteSchema = z.object({
	...SHARED_SCHEMA('feedbackUpvote'),
	feedbackId: zid('feedback'),
	authorProfileId: zid('profile'),
});

export type FeedbackUpvote = z.infer<typeof feedbackUpvoteSchema>;
