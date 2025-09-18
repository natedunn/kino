import { GenericQueryCtx } from 'convex/server';

import { DataModel } from '@/convex/_generated/dataModel';

import { components } from '../../_generated/api';

type GetOrgUserDataArgs = {
	slug: string;
};

export const getOrgDetails = async (ctx: GenericQueryCtx<DataModel>, args: GetOrgUserDataArgs) => {
	return await ctx.runQuery(components.betterAuth.org.getDetails, {
		slug: args.slug,
	});
};
