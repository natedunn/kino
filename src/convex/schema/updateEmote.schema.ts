import { zid } from 'convex-helpers/server/zod4';
import * as z from 'zod';

import { SHARED_SCHEMA } from './_shared';
import { emoteContentSchema } from './emote.shared';

// Reactions on the update itself
export const updateEmoteSchema = z.object({
	...SHARED_SCHEMA('updateEmote'),
	updateId: zid('update'),
	authorProfileId: zid('profile'),
	content: emoteContentSchema,
});

export type UpdateEmote = z.infer<typeof updateEmoteSchema>;
