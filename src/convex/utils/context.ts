import { customCtx, NoOp } from 'convex-helpers/server/customFunctions';

import { MutationCtx, QueryCtx } from '../_generated/server';
import { authComponent } from '../auth';
import { triggers } from './trigger';

export const queryCtx = NoOp;

export const queryCtxAuthed = customCtx(async (ctx: QueryCtx) => {
	const user = await ctx.auth.getUserIdentity();

	if (!user) {
		throw new Error('Authentication required -> verifyQueryCtx');
	}

	return { user };
});

export const mutationCtx = customCtx(async (ctx: MutationCtx) => {
	return triggers.wrapDB(ctx);
});

export const mutationCtxAuthed = customCtx(async (ctx: MutationCtx) => {
	const user = await authComponent.getAuthUser(ctx);

	if (!user) {
		throw new Error('Authentication required -> verifyMutationCtx');
	}

	return {
		...triggers.wrapDB(ctx),
		user,
	};
});

export const actionCtx = NoOp;
