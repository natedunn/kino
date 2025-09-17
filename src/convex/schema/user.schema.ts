import { z } from 'zod';

import { SHARED_SCHEMA } from './_shared';

export const userSchema = z.object({
	...SHARED_SCHEMA('user'),
	imageKey: z.string().optional(),
	bio: z.string().max(150).optional(),
	location: z.string().optional(),
	urls: z.object({ url: z.string().url(), text: z.string() }).array().optional().default([]),
});

export const createUserSchema = userSchema;

export const userSelectSchema = userSchema.pick({
	_creationTime: true,
	_id: true,
	location: true,
	urls: true,
	bio: true,
});

export const userUpdateSchema = userSchema.partial();

export type CreateUserSchema = z.infer<typeof createUserSchema>;
export type UserSelectSchema = z.infer<typeof userSelectSchema>;
export type UserUpdateSchema = z.infer<typeof userUpdateSchema>;
