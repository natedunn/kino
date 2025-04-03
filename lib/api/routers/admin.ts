import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { authClient } from '@/kit/auth/client';
import { db } from '@/kit/db';
// import { log } from '@/kit/utils';
import { userSchema } from '@/lib/db/schema/auth';
import { user } from '@/lib/db/tables/auth';
import { env } from '@/lib/env/server';

import { procedure } from '../procedures';

export const adminRouter = {
	listAllUsers: procedure.admin
		.input(
			z
				.object({
					limit: z.number().optional().default(10),
				})
				.optional()
				.default({
					limit: 10,
				})
		)
		.query(async ({ ctx, input }) => {
			const { data } = await authClient(ctx.req).admin.listUsers({
				query: {
					limit: input.limit,
				},
			});

			return {
				users: userSchema.read
					.pick({
						id: true,
						username: true,
						email: true,
						role: true,
					})
					.array()
					.nullable()
					.parse(data?.users ?? null),
				limit: input.limit,
			};
		}),
	updateUser: procedure.admin
		.input(
			userSchema.update.merge(userSchema.read.pick({ id: true })).merge(
				z.object({
					prevEmail: z.string(),
				})
			)
		)
		.mutation(async ({ input }) => {
			if (env.ADMIN_EMAIL === input.prevEmail && env.ADMIN_EMAIL !== input.email) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: `Cannot change ${env.ADMIN_EMAIL} your email to ${input.email}. Update env variables before making this change.`,
				});
			}

			if (input.role !== 'admin' && env.ADMIN_EMAIL === input.email) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: `Cannot change ${env.ADMIN_EMAIL} to non-admin role. Update env variables before making this change.`,
				});
			}

			await db.update(user).set(input).where(eq(user.id, input.id));
		}),
};
