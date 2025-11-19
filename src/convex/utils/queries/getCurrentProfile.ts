import type { Id } from '@convex/_generated/dataModel';

import { QueryCtx } from '../../_generated/server';
import { authComponent } from '../../auth';
import { selectProfileSchema } from '../../schema/profile.schema';
import { userUploadsR2 } from '../r2';

export const getCurrentProfile = async (ctx: QueryCtx) => {
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
