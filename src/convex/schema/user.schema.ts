import { z } from 'zod';

import { SHARED_SCHEMA } from './_shared';

export const userSchema = z.object({
	...SHARED_SCHEMA('user'),
	email: z.string().email(),
	imageUrl: z.string().url().optional(),
	imageKey: z.string().optional(),
	username: z.string().min(3).max(20),
	name: z.string().min(1).max(100),
	bio: z.string().max(150).optional(),
	banned: z.boolean().default(false),
	private: z.boolean().default(false),
	globalRole: z.enum(['user', 'admin']).default('user'),
	location: z.string().optional(),
	urls: z.object({ url: z.string().url(), text: z.string() }).array().optional().default([]),
});

export const createUserSchema = userSchema;

export const userSelectSchema = userSchema.pick({
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
	_id: true,
});

export const userUpdateSchema = userSchema.partial();

export type CreateUserSchema = z.infer<typeof createUserSchema>;
export type UserSelectSchema = z.infer<typeof userSelectSchema>;
export type UserUpdateSchema = z.infer<typeof userUpdateSchema>;
