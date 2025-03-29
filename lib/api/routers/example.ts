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

		// const data = await db.query.user.findMany({
		// 	limit: 10,
		// });

		// const host = ctx.req.headers.get('x-forwarded-host') || ctx.req.headers.get('host');
		// const protocol = host?.includes('localhost') ? 'http://' : 'https://';

		// log.box(`${protocol}${host}`);

		const { data } = await authClient(ctx.req).admin.listUsers({
			query: {
				limit: 10,
			},
		});

		// const test = await fetch(`${protocol}${host}/api/auth/admin/list-users?limit=10`);

		// log.warn(ctx.req.headers.get('x-forwarded-host'), ctx.req.headers.get('host'), test);

		// log.info(
		// 	'testing',
		// 	`${getBaseUrl({
		// 		relativePath: false,
		// 	})}/api/auth/admin/list-users?limit=10`,
		// 	test
		// );

		return {
			adminEmail: user.email,
			allUsers: data,
		};
	}),
});
