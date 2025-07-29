import {
	customAction,
	customCtx,
	customMutation,
	customQuery,
} from 'convex-helpers/server/customFunctions';
import { zCustomAction, zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod';

import { Id } from '../../_generated/dataModel';
import {
	action,
	ActionCtx,
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
	MutationCtx,
	query,
	QueryCtx,
} from '../../_generated/server';
import { triggers } from '../utils/trigger';
import { Procedure } from '../utils/types';

export const verifyQueryCtx = customCtx(async (ctx: QueryCtx) => {
	const userIdentity = await ctx.auth.getUserIdentity();

	if (!userIdentity) {
		throw new Error('Authentication required -> verifyQueryCtx');
	}

	const user = await ctx.db.get(userIdentity.subject as Id<'user'>);

	if (!user) {
		throw new Error('No user found');
	}

	return { user, userIdentity };
});

export const verifyMutationCtx = customCtx(async (ctx: MutationCtx) => {
	const userIdentity = await ctx.auth.getUserIdentity();

	if (!userIdentity) {
		throw new Error('Authentication required -> verifyMutationCtx');
	}

	const user = await ctx.db.get(userIdentity.subject as Id<'user'>);

	if (!user) {
		throw new Error('No user found');
	}

	return {
		...triggers.wrapDB(ctx),
		user,
		userIdentity,
	};
});

export const verifyActionCtx = customCtx(async (ctx: ActionCtx) => {
	const userIdentity = await ctx.auth.getUserIdentity();

	if (!userIdentity) {
		throw new Error('Authentication required -> verifyActionCtx');
	}

	return { userIdentity };
});

export const authed = {
	external: {
		query: zCustomQuery(query, verifyQueryCtx),
		mutation: zCustomMutation(mutation, verifyMutationCtx),
		action: zCustomAction(action, verifyActionCtx),
	},
	internal: {
		query: zCustomQuery(internalQuery, verifyQueryCtx),
		mutation: zCustomMutation(internalMutation, verifyMutationCtx),
		action: zCustomAction(internalAction, verifyActionCtx),
	},
	_convex: {
		external: {
			query: customQuery(query, verifyQueryCtx),
			mutation: customMutation(mutation, verifyMutationCtx),
			action: customAction(action, verifyActionCtx),
		},
		internal: {
			query: customQuery(internalQuery, verifyQueryCtx),
			mutation: customMutation(internalMutation, verifyMutationCtx),
			action: customAction(internalAction, verifyActionCtx),
		},
	},
} satisfies Procedure;
