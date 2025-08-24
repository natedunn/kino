import { createAuth } from '@/lib/auth';

import { betterAuthComponent } from './auth';
import { procedure } from './procedure';
import { createTeamSchema } from './team.utils';

export const create = procedure.authed.external.mutation({
	args: createTeamSchema,
	handler: async (ctx, args) => {
		const auth = createAuth(ctx);
		const team = await auth.api.createOrganization({
			body: args,
			headers: await betterAuthComponent.getHeaders(ctx),
		});

		return team;
	},
});
