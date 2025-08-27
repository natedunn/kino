import { getOneFrom } from 'convex-helpers/server/relationships';
import { zid } from 'convex-helpers/server/zod';
import { paginationOptsValidator } from 'convex/server';

import { limits } from '@/config/limits';
import { createAuth } from '@/lib/auth';

import { Id } from '../_generated/dataModel';
import { userSchema } from '../schema';
import { betterAuthComponent } from './auth';
import { procedure } from './procedure';
import { getUserByIdentifier, getUserByIdentifierSchema, userUpdateSchema } from './users.utils';

/**
 * Get a user by their identifier.
 *
 * @param args as typed in {@link getUserByIdentifierSchema}
 * @returns The user with the given identifier or null if not found.
 */
export const get = procedure.base.external.query({
	args: getUserByIdentifierSchema,
	handler: async (ctx, args) => getUserByIdentifier(ctx, args),
});

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

/**
 * Get a list of users.
 *
 * @param [args.paginationOpts] as typed in {@link paginationOptsValidator}
 * @returns A list of users
 */
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

/**
 * Externally update a user in Clerk.
 *
 * This means this should ALWAYS check if the user is authenticated first,
 * since it is not an internal action.
 *
 * @param [args.user] as typed in {@link userUpdateSchema}
 * @param [args.updateClerk] whether to update the user's Clerk ID
 * @returns The updated user
 */
export const update = procedure.authed.external.mutation({
	args: userUpdateSchema,
	handler: async (ctx, args) => {
		const { userIdentity } = ctx;

		const { username, name, email, _id, ...rest } = args;

		await ctx.db.patch(userIdentity.subject as Id<'user'>, rest);

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
