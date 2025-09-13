import { GenericQueryCtx } from 'convex/server';

import { components } from '@/convex/_generated/api';
import { DataModel } from '@/convex/_generated/dataModel';

export const getInternalUserId = async (ctx: GenericQueryCtx<DataModel>, userId: string) => {
	if (!userId) {
		return null;
	}
	const user = await ctx
		.runQuery(components.betterAuth.lib.findOne, {
			model: 'user',
			where: [{ field: 'userId', operator: 'eq', value: userId }],
		})
		.catch(() => null);

	const internalUserId = user?._id as string | null;
	return internalUserId;
};
