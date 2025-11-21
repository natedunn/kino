import * as z from 'zod';

import { SHARED_SCHEMA } from './_shared';

export const profileSchema = z.object({
	...SHARED_SCHEMA('profile'),
	imageKey: z.string().optional(),
	imageUrl: z.string().optional(),
	bio: z.string().max(150).optional(),
	location: z.string().optional(),
	urls: z.object({ url: z.string().url(), text: z.string() }).array().optional(),
	userId: z.string(),
	// 👇 Better-Auth mirrors
	username: z.string(),
	email: z.email(),
	role: z.enum(['system:admin', 'system:editor', 'user']).default('user'),
	name: z.string(),
});

export const createProfileSchema = profileSchema;

export const selectProfileSchema = profileSchema.pick({
	_creationTime: true,
	_id: true,
	location: true,
	urls: true,
	bio: true,
	role: true,
	username: true,
	email: true,
	imageUrl: true,
	imageKey: true,
	name: true,
	userId: true,
});
export const updateProfileSchema = profileSchema
	.pick({
		imageKey: true,
		bio: true,
		location: true,
		urls: true,
	})
	.partial();

export const syncProfileSchema = profileSchema.pick({
	username: true,
	email: true,
	imageUrl: true,
	name: true,
	role: true,
});

export type CreateProfileSchema = z.infer<typeof createProfileSchema>;
export type SelectProfileSchema = z.infer<typeof selectProfileSchema>;
export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>;
