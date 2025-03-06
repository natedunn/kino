import { z } from 'zod';

import { t } from '@/kit/api';
import { authClient } from '@/kit/auth/client';

import { procedure } from '../procedures';

export const exampleRouter = t.router({
	open: procedure.open.input(z.string()).query(async ({ input, ctx }) => {
		const date = new Date();
		return {
			passedInput: input,
			date: date.toLocaleString(),
			user: !ctx.auth.user?.email ? null : `${ctx.auth.user.email} (not required)`,
		};
	}),
	authed: procedure.auth.input(z.string()).query(async ({ input, ctx }) => {
		const date = new Date();
		return {
			passedInput: input,
			date: date.toLocaleString(),
			user: `${ctx.auth.user.email} (required)`,
		};
	}),
	listUsers: procedure.admin.query(async ({ ctx }) => {
		const user = ctx.auth.user;

		const { data } = await authClient.admin.listUsers({
			query: {
				limit: 10,
			},
			fetchOptions: {
				headers: ctx.req.headers,
			},
		});

		return {
			adminEmail: user.email,
			allUsers: data?.users,
		};
	}),
});
