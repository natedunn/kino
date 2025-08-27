import { BetterAuthError } from 'better-auth';
import { ConvexError } from 'convex/values';

import { limits } from '@/config/limits';
import { createAuth } from '@/lib/auth';

import { betterAuthComponent } from './auth';
import { createOrgSchema } from './org.utils';
import { procedure } from './procedure';

export const create = procedure.authed.external.mutation({
	args: createOrgSchema,
	handler: async (ctx, args) => {
		const auth = createAuth(ctx);

		const orgs = await auth.api.listOrganizations({
			headers: await betterAuthComponent.getHeaders(ctx),
		});

		const user = await betterAuthComponent.getAuthUser(ctx);

		let limit: number;
		if (user?.role === 'admin') {
			limit = limits.admin.MAX_ORGS;
		} else {
			limit = limits.free.MAX_ORGS;
		}

		if (orgs.length >= limit) {
			throw new ConvexError({
				message: 'Maximum number of teams created',
				code: '403',
			});
		}

		const org = await auth.api
			.createOrganization({
				body: args,
				headers: await betterAuthComponent.getHeaders(ctx),
			})
			.catch((error: BetterAuthError) => {
				throw new ConvexError({
					message: error.message,
					code: '500',
				});
			});

		return org;
	},
});
