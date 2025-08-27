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

		const orgs = await auth.api.listOrganizations({
			headers: await betterAuthComponent.getHeaders(ctx),
		});

		if (orgs.length === 0) {
			throw new ConvexError({
				message: 'No orgs found',
				code: '404',
			});
		}

		if (!orgs.find((org) => org.id === args.orgId)) {
			throw new ConvexError({
				message: 'Cannot find org or does not have permission',
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
