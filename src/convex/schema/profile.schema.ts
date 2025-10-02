import { convexToZod } from 'convex-helpers/server/zod';
import { v } from 'convex/values';
import { z } from 'zod';

import { SHARED_SCHEMA } from './_shared';

const betterAuthUserSchema = convexToZod(
	v.object({
		name: v.string(),
		email: v.string(),
		emailVerified: v.boolean(),
		// Note: removed nullable do to type errors
		image: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
		// This username does not reflect the better-auth schema, however we are enforcing usernames
		username: v.string(),
		displayUsername: v.optional(v.union(v.null(), v.string())),
		role: v.optional(v.union(v.null(), v.string())),
		banned: v.optional(v.union(v.null(), v.boolean())),
		banReason: v.optional(v.union(v.null(), v.string())),
		banExpires: v.optional(v.union(v.null(), v.number())),
		userId: v.optional(v.union(v.null(), v.string())),
	})
);

export const profileSchema = z.object({
	...SHARED_SCHEMA('profile'),
	imageKey: z.string().optional(),
	imageUrl: z.string().optional(),
	bio: z.string().max(150).optional(),
	location: z.string().optional(),
	urls: z.object({ url: z.string().url(), text: z.string() }).array().optional(),
	userId: z.string(),
});

export const createProfileSchema = profileSchema;

export const selectProfileSchema = profileSchema.pick({
	_creationTime: true,
	_id: true,
	location: true,
	urls: true,
	bio: true,
});
export const updateProfileSchema = profileSchema.partial();

// Merged with User
export const selectProfileUserSchema = selectProfileSchema.merge(betterAuthUserSchema);
export const updateProfileUserSchema = profileSchema
	.pick({
		imageKey: true,
		bio: true,
		location: true,
		urls: true,
	})
	.merge(
		betterAuthUserSchema.pick({
			name: true,
			image: true,
			username: true,
		})
	);

export type SelectSafeUserSchema = z.infer<typeof selectProfileUserSchema>;
export type CreateProfileSchema = z.infer<typeof createProfileSchema>;
export type SelectProfileSchema = z.infer<typeof selectProfileSchema>;
export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>;
