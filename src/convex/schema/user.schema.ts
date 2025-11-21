import { tables } from '@convex/betterAuth/generatedSchema';
import { convexToZod } from 'convex-helpers/server/zod4';
import z from 'zod';

const userSchema = convexToZod(tables.user.validator).extend(
	z.object({
		image: z.string().optional(),
		// name: z.string().optional().nullable(),
	}).shape
);

export const selectUserSchema = userSchema;
export const updateUserSchema = userSchema.partial().pick({
	name: true,
	image: true,
	username: true,
	role: true,
});
