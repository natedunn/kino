import { selectOrgSchema } from '@convex/schema/org.schema';
import { GenericQueryCtx } from 'convex/server';

import { DataModel } from './_generated/dataModel';

export const getOrgBySlug = async (ctx: GenericQueryCtx<DataModel>, slug: string) => {
	return await ctx.db
		.query('organization')
		.withIndex('slug', (q) => q.eq('slug', slug))
		.unique()
		.then((res) => {
			if (!res) return null;
			return selectOrgSchema.parse(res);
		})
		.catch((error) => {
			console.error(error);
			return null;
		});
};
