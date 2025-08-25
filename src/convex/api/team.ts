import { ConvexError } from 'convex/values';

import { limits } from '@/config/limits';
import { createAuth } from '@/lib/auth';

import { betterAuthComponent } from './auth';
import { procedure } from './procedure';
import { createTeamSchema } from './team.utils';

export const create = procedure.authed.external.mutation({
	args: createTeamSchema,
	handler: async (ctx, args) => {
		const auth = createAuth(ctx);

		const teams = await auth.api.listOrganizations({
			headers: await betterAuthComponent.getHeaders(ctx),
		});

		const user = await betterAuthComponent.getAuthUser(ctx);

		let limit: number;
		if (user?.role === 'admin') {
			limit = limits.admin.MAX_TEAMS;
		} else {
			limit = limits.free.MAX_TEAMS;
		}

		if (teams.length >= limit) {
			throw new ConvexError({
				message: 'Maximum number of teams created',
				code: '403',
			});
		}

		const team = await auth.api.createOrganization({
			body: args,
			headers: await betterAuthComponent.getHeaders(ctx),
		});

		return team;
	},
});
