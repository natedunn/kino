import { GenericQueryCtx } from 'convex/server';
import { z } from 'zod';

import { components } from '@/convex/_generated/api';
import { DataModel } from '@/convex/_generated/dataModel';

export const getOrgBySlug = async (ctx: GenericQueryCtx<DataModel>, slug: string) => {
	const data = await ctx.runQuery(components.betterAuth.adapter.findOne, {
		model: 'organization',
		where: [{ field: 'slug', operator: 'eq', value: slug }],
	});

	if (!data) return null;

	return z
		.object({
			_creationTime: z.number(),
			_id: z.string(),
			name: z.string(),
			slug: z.string(),
		})
		.parse(data);
};
