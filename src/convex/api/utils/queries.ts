import type { DataModel, Id } from '@/convex/_generated/dataModel';
import type { GenericQueryCtx } from 'convex/server';

import { ConvexError } from 'convex/values';
import z from 'zod';

import { components } from '@/convex/_generated/api';

export const getOrgBySlug = async (ctx: GenericQueryCtx<DataModel>, slug: string) => {
	const data = await ctx.runQuery(components.betterAuth.lib.findOne, {
		model: 'organization',
		where: [{ field: 'slug', operator: 'eq', value: slug }],
	});

	return z
		.object({
			_creationTime: z.number(),
			_id: z.string(),
			name: z.string(),
			slug: z.string(),
		})
		.parse(data);
};

export const getInternalUserId = async (ctx: GenericQueryCtx<DataModel>, userId: string) => {
	const user = await ctx
		.runQuery(components.betterAuth.lib.findOne, {
			model: 'user',
			where: [{ field: 'userId', operator: 'eq', value: userId }],
		})
		.catch(() => null);

	const internalUserId = user?._id as string | null;
	return internalUserId;
};
