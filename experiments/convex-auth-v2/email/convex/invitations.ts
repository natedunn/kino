import { makeFunctionReference } from 'convex/server';
import { ConvexError } from 'convex/values';

import { createArgs, createInvitation } from '../../organizations/convex/invitations';
import { mutation } from './_generated/server';

export { accept, cancel, reject, inspect } from '../../organizations/convex/invitations';
export const create = mutation({
	args: createArgs,
	handler: async (ctx, args) => {
		if (args.email.trim().toLowerCase() !== process.env.PROOF_EMAIL)
			throw new ConvexError('PROOF_RECIPIENT_ONLY');
		const invitationId = await createInvitation(ctx, args);
		await ctx.scheduler.runAfter(0, makeFunctionReference<'action'>('invitationMail:deliver'), {
			invitationId,
		});
		return invitationId;
	},
});
