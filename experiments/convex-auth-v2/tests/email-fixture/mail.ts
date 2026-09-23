import { v } from 'convex/values';

import { internalAction } from './_generated/server';

// Substitutes for the external email transport ONLY. Raw codes never enter the
// app challenge table or a public response. The scheduler carries the email job.
export const mailbox: Array<{ email: string; purpose: 'verify' | 'reset'; code: string }> = [];
export const deliver = internalAction({
	args: {
		email: v.string(),
		purpose: v.union(v.literal('verify'), v.literal('reset')),
		code: v.string(),
	},
	handler: async (_ctx, args) => {
		mailbox.push(args);
		return null;
	},
});
