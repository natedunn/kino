import { getOneFrom } from 'convex-helpers/server/relationships';
import { zid } from 'convex-helpers/server/zod';
import { GenericQueryCtx } from 'convex/server';
import z from 'zod';

import { DataModel, Doc, Id } from '../_generated/dataModel';
import { userSchema, userSelectSchema, UserSelectSchema } from '../schema/user.schema';
import { userUploadsR2 } from './utils/r2';

export const getUserByIdentifierSchema = z.object({
	_id: userSchema.shape._id.nullish(),
	email: userSchema.shape.email.nullish(),
	username: userSchema.shape.username.nullish(),
});

type GetUserIdentifier = z.infer<typeof getUserByIdentifierSchema>;

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

	const { imageUrl, imageKey, ...rest } = user;

	let image: string | undefined;
	if (imageKey) {
		image = await userUploadsR2.getUrl(imageKey, {
			expiresIn: 60 * 60 * 24,
		});
	} else {
		image = imageUrl;
	}

	return userSelectSchema.parse({
		...rest,
		imageKey,
		imageUrl: image,
	});
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
