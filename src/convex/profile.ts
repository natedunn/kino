import { GenericQueryCtx, paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { LIMITS } from '@/config/limits';
import { createAuth } from '@/convex/auth';

import { DataModel, Id } from './_generated/dataModel';
import { authComponent } from './auth';
import { getProfileUser } from './profile.utils';
import { updateProfileUserSchema } from './schema/profile.schema';
import { mutation, query, zMutation, zQuery } from './utils/functions';
import { userUploadsR2 } from './utils/r2';
import { verify } from './utils/verify';

export const getList = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: async (ctx, args) => {
		const results = ctx.db
			.query('profile')
			// TODO: add a filter back
			// .filter((q) => {
			// 	return q.or(q.eq(q.field('private'), false), q.eq(q.field('private'), undefined));
			// })
			.order('desc')
			.paginate(args.paginationOpts);

		return results;
	},
});

export const update = zMutation({
	args: updateProfileUserSchema,
	handler: async (ctx, args) => {
		const { userId } = await verify.auth(ctx, {
			throw: true,
		});

		if (userId !== args.profile.userId) {
			throw new ConvexError({
				message: 'User does not have permission',
				code: '403',
			});
		}

		const auth = createAuth(ctx);

		const { userId: _userId, ...profileData } = args.profile;

		// 1️⃣ Update profile-only data first...
		await verify.patch({
			ctx,
			tableName: 'profile',
			data: profileData,
		});

		// 2️⃣ ...then update user-only data (Better-Auth user data). This will
		// then update profile data via Better-Auth's trigger. It more distance
		// to travel, but it is the correct flow.
		await auth.api.updateUser({
			headers: await authComponent.getHeaders(ctx),
			body: args.user,
		});
	},
});

export const getTeamList = zQuery({
	args: {},
	handler: async (ctx) => {
		const profileId = (await authComponent.getAuthUser(ctx))?.profileId;

		if (!profileId) {
			return null;
		}

		const auth = createAuth(ctx);
		const teams = await auth.api.listOrganizations({
			headers: await authComponent.getHeaders(ctx),
		});

		const user = await authComponent.getAuthUser(ctx);

		// TODO reimplement this
		// let limit = LIMITS.FREE.MAX_ORGS;
		let limit: number;
		if (user?.role === 'admin') {
			limit = LIMITS.ADMIN.MAX_ORGS;
		} else {
			limit = LIMITS.FREE.MAX_ORGS;
		}

		return { teams, underLimit: teams.length < limit };
	},
});

export const getCurrentProfileUser = query({
	args: {},
	handler: async (ctx) => {
		const user = await getProfileUser(ctx);
		return user ?? null;
	},
});

export const { generateUploadUrl, syncMetadata } = userUploadsR2.clientApi({
	checkUpload: async (ctx: GenericQueryCtx<DataModel>, bucket) => {
		const profileId = (await authComponent.getAuthUser(ctx))?.profileId;

		if (!profileId) {
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

		const userId = user?.profileId;

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
			await ctx.db.patch(userId as Id<'profile'>, {
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

export const generateUserUploadUrl = mutation({
	args: {
		type: v.string(),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);

		if (!user) {
			throw new ConvexError({
				message: 'Unauthorized — no user is authenticated',
				code: '401',
			});
		}

		const key = `${args.type}_${user.profileId}${args.type !== 'PFP' ? `.${crypto.randomUUID()}` : ''}`;
		return userUploadsR2.generateUploadUrl(key);
	},
});
