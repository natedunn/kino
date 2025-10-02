import { withoutSystemFields } from 'convex-helpers';

import { Id } from './_generated/dataModel';
import { QueryCtx } from './_generated/server';
import { authComponent } from './auth';
import { selectProfileUserSchema } from './schema/profile.schema';
import { userUploadsR2 } from './utils/r2';

export const getProfileUser = async (ctx: QueryCtx) => {
	const authUser = await authComponent.safeGetAuthUser(ctx);

	if (!authUser?._id) {
		return;
	}
	const user = await ctx.db.get(authUser.userId as Id<'profile'>);
	if (!user) {
		return;
	}

	// Handler avatar image
	let trueImage: string | undefined;
	if (user.imageKey) {
		trueImage = await userUploadsR2.getUrl(user.imageKey, {
			expiresIn: 60 * 60 * 24,
		});
	} else if (authUser?.image) {
		trueImage = authUser.image;
	} else {
		trueImage = undefined;
	}

	const { image, ...nonImageAuthUser } = authUser;

	const mergedUser = {
		...user, //
		...withoutSystemFields(nonImageAuthUser),
		image: trueImage,
	};

	return selectProfileUserSchema.parse(mergedUser);
};
