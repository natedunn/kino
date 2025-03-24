import { betterFetch } from '@better-fetch/fetch';
import { z } from 'zod';

import { t } from '@/kit/api';
import { authClient } from '@/kit/auth/client';
import { db } from '@/kit/db';
import { getBaseUrl, log } from '@/kit/utils';

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

		const data = await db.query.user.findMany({
			limit: 10,
		});

		const { data: test } = await authClient.admin.listUsers({
			query: {
				limit: 10,
			},
			fetchOptions: {
				headers: ctx.req.headers,
			},
		});

		// const test = await fetch(
		// 	`${getBaseUrl({
		// 		relativePath: false,
		// 	})}/api/auth/admin/list-users?limit=10`
		// );

		log.info(
			'testing',
			`${getBaseUrl({
				relativePath: false,
			})}/api/auth/admin/list-users?limit=10`,
			test
		);

		return {
			adminEmail: user.email,
			allUsers: {
				users: data,
				limit: 10,
			},
		};
	}),
});
