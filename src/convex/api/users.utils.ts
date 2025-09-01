import { getOneFrom } from 'convex-helpers/server/relationships';
import { zid } from 'convex-helpers/server/zod';
import { GenericQueryCtx } from 'convex/server';
import z from 'zod';

import { DataModel, Doc, Id } from '../_generated/dataModel';
import { userSchema } from '../schema';

export const getUserByIdentifierSchema = z.object({
	_id: userSchema.shape._id.nullish(),
	email: userSchema.shape.email.nullish(),
	username: userSchema.shape.username.nullish(),
});

type GetUserIdentifier = z.infer<typeof getUserByIdentifierSchema>;

export const userSelectSchema = userSchema
	.pick({
		username: true,
		email: true,
		imageUrl: true,
		location: true,
		urls: true,
		bio: true,
		private: true,
		name: true,
		banned: true,
		_creationTime: true,
	})
	.merge(
		z.object({
			_id: zid('user'),
		})
	);

export type UserSelectSchema = z.infer<typeof userSelectSchema>;

export const userUpdateSchema = userSchema.partial();

export type UserUpdateSchema = z.infer<typeof userUpdateSchema>;

/**
 * Helper function to get a user by a given identifier.
 *
 * @param ctx - The context object.
 * @param args - The identifier to use to find the user.
 */
export const getUserByIdentifier = async <T extends boolean = false>(
	ctx: Omit<GenericQueryCtx<DataModel>, never>,
	args: GetUserIdentifier,
	throwIfNotFound: T = false as T
): Promise<T extends true ? UserSelectSchema : UserSelectSchema | null> => {
	if (Object.keys(args).length === 0) {
		console.warn('No identifier provided');
		return null as T extends true ? never : null;
	}

	let user;

	if (args?._id) {
		user = (await ctx.db.get(args._id)) as Doc<'user'> | null;
	}

	if (args?.email) {
		user = (await getOneFrom(
			ctx.db,
			'user',
			'by_email',
			args.email,
			'email'
		)) as Doc<'user'> | null;
	}

	if (args?.username) {
		user = (await getOneFrom(
			ctx.db,
			'user',
			'by_username',
			args.username,
			'username'
		)) as Doc<'user'> | null;
	}

	if (!user) {
		if (throwIfNotFound as T) {
			throw new Error(`No user found with identifier: ${JSON.stringify(args)}`);
		} else {
			return null as T extends true ? never : null;
		}
	}

	return userSelectSchema.parse(user);
};

/**
 * Get current authenticated Clerk user from the query context
 *
 * @param ctx - Query context
 * @returns - The current authenticated Clerk user
 */
export const getUser = async (ctx: Omit<GenericQueryCtx<DataModel>, never>) => {
	const identity = await ctx.auth.getUserIdentity();
	return getUserByIdentifier(ctx, {
		_id: identity?.subject as Id<'user'>,
	});
};
