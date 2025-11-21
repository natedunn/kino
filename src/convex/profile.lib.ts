import type { Id } from '@convex/_generated/dataModel';

import { ConvexError } from 'convex/values';

import { QueryCtx } from './_generated/server';
import { authComponent } from './auth';
import { selectProfileSchema } from './schema/profile.schema';
import { userUploadsR2 } from './utils/r2';

const _findMyProfile = async (ctx: QueryCtx) => {
	const authUser = await authComponent.safeGetAuthUser(ctx);

	if (!authUser?._id) {
		return null;
	}
	const profile = await ctx.db.get(authUser.profileId as Id<'profile'>);
	if (!profile) {
		return null;
	}

	// Handle true avatar image
	let trueImage: string | undefined;
	if (profile.imageKey) {
		trueImage = await userUploadsR2.getUrl(profile.imageKey, {
			expiresIn: 60 * 60 * 24,
		});
	} else if (authUser?.image) {
		trueImage = authUser.image;
	} else {
		// TODO: set default image URL here
		trueImage = undefined;
	}

	const mergedUser = {
		...profile,
		imageUrl: trueImage,
	};

	return selectProfileSchema.parse(mergedUser);
};

export const findMyProfile = async (ctx: QueryCtx) => await _findMyProfile(ctx);

export const getMyProfile = async (ctx: QueryCtx) => {
	const profile = await _findMyProfile(ctx);
	if (!profile) {
		throw new ConvexError({
			message: 'Profile not found',
			code: '404',
		});
	}
	return profile;
};
