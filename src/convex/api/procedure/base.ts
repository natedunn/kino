import {
	customAction,
	customCtx,
	customMutation,
	customQuery,
	NoOp,
} from 'convex-helpers/server/customFunctions';
import { zCustomAction, zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod';

import {
	action,
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
	MutationCtx,
	query,
} from '../../_generated/server';
import { triggers } from '../utils/trigger';
import { Procedure } from '../utils/types';

export const triggersCtx = customCtx(async (ctx: MutationCtx) => {
	return {
		...ctx,
		db: triggers.wrapDB(ctx),
	};
});

export const base = {
	external: {
		query: zCustomQuery(query, NoOp),
		mutation: zCustomMutation(mutation, triggersCtx),
		action: zCustomAction(action, NoOp),
	},
	internal: {
		query: zCustomQuery(internalQuery, NoOp),
		mutation: zCustomMutation(internalMutation, triggersCtx),
		action: zCustomAction(internalAction, NoOp),
	},
	_convex: {
		external: {
			query: customQuery(query, NoOp),
			mutation: customMutation(mutation, triggersCtx),
			action: customAction(action, NoOp),
		},
		internal: {
			query: customQuery(internalQuery, NoOp),
			mutation: customMutation(internalMutation, triggersCtx),
			action: customAction(internalAction, NoOp),
		},
	},
} satisfies Procedure;
