import type { DataModel } from '@/convex/_generated/dataModel';
import type { GenericQueryCtx } from 'convex/server';

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
