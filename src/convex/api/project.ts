import { ConvexError } from 'convex/values';

import { createAuth } from '@/lib/auth';

import { betterAuthComponent } from './auth';
import { procedure } from './procedure';
import { createProjectSchema } from './project.utils';
import { verify } from './utils/verify';

export const create = procedure.authed.external.mutation({
	args: createProjectSchema,
	handler: async (ctx, args) => {
		const auth = createAuth(ctx);

		const teams = await auth.api.listOrganizations({
			headers: await betterAuthComponent.getHeaders(ctx),
		});

		if (teams.length === 0) {
			throw new ConvexError({
				message: 'No teams found',
				code: '404',
			});
		}

		if (!teams.find((team) => team.id === args.teamId)) {
			throw new ConvexError({
				message: 'Cannot find team or does not have permission',
				code: '403',
			});
		}

		await verify.insert({
			ctx,
			tableName: 'project',
			data: args,
			onFail: ({ uniqueRow }) => {
				throw new ConvexError({
					message: `A project with the slug of '${uniqueRow?.existingData.slug}' already exists for this team.`,
				});
			},
		});
	},
});
