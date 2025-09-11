import { getOneFrom } from 'convex-helpers/server/relationships';
import { zid } from 'convex-helpers/server/zod';
import { GenericQueryCtx, paginationOptsValidator } from 'convex/server';
import { ConvexError } from 'convex/values';
import { z } from 'zod';

import { limits } from '@/config/limits';
import { createAuth } from '@/lib/auth';

import { DataModel, Id } from '../_generated/dataModel';
import { userSchema, userUpdateSchema } from '../schema/user.schema';
import { betterAuthComponent } from './auth';
import { procedure } from './procedure';
// import { getUserByIdentifier, getUserByIdentifierSchema } from './user.utils';
import { userUploadsR2 } from './utils/r2';

// export const get = procedure.base.external.query({
// 	args: getUserByIdentifierSchema,
// 	handler: async (ctx, args) => getUserByIdentifier(ctx, args),
// });

export const getUserIndexes = procedure.base.external.query({
	args: {
		_id: zid('user'),
	},
	handler: async (ctx, args) => {
		const user = await getOneFrom(ctx.db, 'user', 'by_id', args._id, '_id');

		return userSchema
			.pick({
				_id: true,
				email: true,
				username: true,
				globalRole: true,
			})
			.parse(user);
	},
});

export const getList = procedure.base._convex.external.query({
	args: { paginationOpts: paginationOptsValidator },
	handler: async (ctx, args) => {
		const results = ctx.db
			.query('user')
			.filter((q) => {
				return q.or(q.eq(q.field('private'), false), q.eq(q.field('private'), undefined));
			})
			.order('desc')
			.paginate(args.paginationOpts);

		return results;
	},
});

export const getUserImage = procedure.base.external.query({
	args: {
		_id: zid('user'),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db.get(args._id);

		if (!user) {
			return null;
		}

		return user.imageUrl;
	},
});

export const update = procedure.authed.external.mutation({
	args: userUpdateSchema,
	handler: async (ctx, args) => {
		const auth = createAuth(ctx);

		const { username, name, ..._rest } = args;

		await auth.api.updateUser({
			body: {
				username,
				name,
			},
			headers: await betterAuthComponent.getHeaders(ctx),
		});

		return {
			success: true,
		};
	},
});

export const getTeamList = procedure.base.external.query({
	args: {},
	handler: async (ctx) => {
		const userIdentity = await ctx.auth.getUserIdentity();

		if (!userIdentity) {
			return null;
		}

		const auth = createAuth(ctx);
		const teams = await auth.api.listOrganizations({
			headers: await betterAuthComponent.getHeaders(ctx),
		});

		const user = await betterAuthComponent.getAuthUser(ctx);

		let limit: number;
		if (user?.role === 'admin') {
			limit = limits.admin.MAX_ORGS;
		} else {
			limit = limits.free.MAX_ORGS;
		}

		return { teams, underLimit: teams.length < limit };
	},
});

export const { generateUploadUrl, syncMetadata } = userUploadsR2.clientApi({
	checkUpload: async (ctx: GenericQueryCtx<DataModel>, bucket) => {
		const userIdentity = await ctx.auth.getUserIdentity();

		if (!userIdentity) {
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
		const userIdentity = await ctx.auth.getUserIdentity();

		if (!userIdentity) {
			throw new ConvexError({
				code: '500',
				message: 'Internal server error — user is not authenticated (even though they should be)',
			});
		}

		const userIdFromKey = key.split('_')[1].split('.')[0];

		if (userIdFromKey !== userIdentity.subject) {
			throw new ConvexError({
				code: '403',
				message: 'Forbidden — user is not authorized (even though they should be)',
			});
		}

		const typeFromKey = key.split('_')[0];

		if (typeFromKey === 'PFP') {
			await ctx.db.patch(userIdentity.subject as Id<'user'>, {
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

export const generateUserUploadUrl = procedure.authed.external.mutation({
	args: {
		type: z.enum(['PFP']),
	},
	handler: async (ctx, args) => {
		const key = `${args.type}_${ctx.user._id}${args.type !== 'PFP' ? `.${crypto.randomUUID()}` : ''}`;
		return userUploadsR2.generateUploadUrl(key);
	},
});
