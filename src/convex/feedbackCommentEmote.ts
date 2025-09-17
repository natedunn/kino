import { zAuthedMutation } from './utils/functions';
import { triggers } from './utils/trigger';

export const create = zAuthedMutation({
	args: {},
	handler: async () => {},
});

triggers.register('feedbackCommentEmote', async () => {});
