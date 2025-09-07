import { procedure } from './procedure';
import { triggers } from './utils/trigger';

export const create = procedure.authed.external.mutation({
	args: {},
	handler: async (ctx) => {},
});

triggers.register('feedbackCommentEmote', async (ctx, change) => {});
