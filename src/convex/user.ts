import { GenericQueryCtx, paginationOptsValidator } from 'convex/server';
import { ConvexError } from 'convex/values';
import { z } from 'zod';

import { limits } from '@/config/limits';
import { createAuth } from '@/convex/auth';

import { components } from './_generated/api';
import { DataModel, Id } from './_generated/dataModel';
import { authComponent } from './auth';
import { selectSafeUserSchema, updateSafeUserSchema } from './schema/user.schema';
import { safeGetUser } from './user.utils';
import { query, zAuthedMutation, zQuery } from './utils/functions';
import { userUploadsR2 } from './utils/r2';

export const getList = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: async (ctx, args) => {
		const results = ctx.db
			.query('user')
			// TODO: add a filter back
			// .filter((q) => {
			// 	return q.or(q.eq(q.field('private'), false), q.eq(q.field('private'), undefined));
			// })
			.order('desc')
			.paginate(args.paginationOpts);

		return results;
	},
});

export const update = zAuthedMutation({
	args: updateSafeUserSchema,
	handler: async (ctx, args) => {
		const auth = createAuth(ctx);

		await auth.api.updateUser({
			body: args,
			headers: await authComponent.getHeaders(ctx),
		});

		return {
			success: true,
		};
	},
});

export const getTeamList = zQuery({
	args: {},
	handler: async (ctx) => {
		const userId = (await authComponent.getAuthUser(ctx))?.userId;

		if (!userId) {
			return null;
		}

		const auth = createAuth(ctx);
		const teams = await auth.api.listOrganizations({
			headers: await authComponent.getHeaders(ctx),
		});

		const user = await authComponent.getAuthUser(ctx);

		// TODO reimplement this
		let limit = limits.free.MAX_ORGS;
		// let limit: number;
		// if (user?.role === 'admin') {
		// 	limit = limits.admin.MAX_ORGS;
		// } else {
		// 	limit = limits.free.MAX_ORGS;
		// }

		return { teams, underLimit: teams.length < limit };
	},
});

export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		const user = await safeGetUser(ctx);
		if (!user) return null;
		return selectSafeUserSchema.parse(user);
	},
});

export const { generateUploadUrl, syncMetadata } = userUploadsR2.clientApi({
	checkUpload: async (ctx: GenericQueryCtx<DataModel>, bucket) => {
		const userId = (await authComponent.getAuthUser(ctx))?.userId;

		if (!userId) {
			throw new ConvexError({
				code: '404',
				message: 'Forbidden — user is not authenticated',
			});
		}

		if (bucket === process.env.R2_USER_UPLOADS_BUCKET) {
			// Run a check here if we need it
		}
	},
	onUpload: async (ctx, _bucket, key) => {
		const user = await authComponent.getAuthUser(ctx);

		console.log(user);

		const userId = user?.userId;

		if (!userId) {
			throw new ConvexError({
				code: '500',
				message: 'Internal server error — user is not authenticated (even though they should be)',
			});
		}

		const userIdFromKey = key.split('_')[1].split('.')[0];

		if (userIdFromKey !== userId) {
			throw new ConvexError({
				code: '403',
				message: 'Forbidden — user is not authorized (even though they should be)',
			});
		}

		const typeFromKey = key.split('_')[0];

		if (typeFromKey === 'PFP') {
			await ctx.db.patch(userId as Id<'user'>, {
				imageKey: key,
			});
		} else {
			throw new ConvexError({
				code: '404',
				message: 'Could not find the correct type for operation',
			});
		}
	},
});

export const generateUserUploadUrl = zAuthedMutation({
	args: {
		type: z.enum(['PFP']),
	},
	handler: async (ctx, args) => {
		const key = `${args.type}_${ctx.user.userId}${args.type !== 'PFP' ? `.${crypto.randomUUID()}` : ''}`;
		return userUploadsR2.generateUploadUrl(key);
	},
});
