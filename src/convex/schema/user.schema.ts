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

export const userSchema = z.object({
	...SHARED_SCHEMA('user'),
	imageKey: z.string().optional(),
	imageUrl: z.string().optional(),
	bio: z.string().max(150).optional(),
	location: z.string().optional(),
	urls: z.object({ url: z.string().url(), text: z.string() }).array().optional(),
});

export const createUserSchema = userSchema;

export const userSelectSchema = userSchema.pick({
	_creationTime: true,
	_id: true,
	location: true,
	urls: true,
	bio: true,
});

export const selectSafeUserSchema = userSelectSchema.merge(betterAuthUserSchema);
export const updateSafeUserSchema = userSchema
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

export const userUpdateSchema = userSchema.partial();

export type CreateUserSchema = z.infer<typeof createUserSchema>;
export type UserSelectSchema = z.infer<typeof userSelectSchema>;
export type UserUpdateSchema = z.infer<typeof userUpdateSchema>;
