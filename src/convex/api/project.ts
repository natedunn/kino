import { ConvexError } from 'convex/values';
import z from 'zod';

import { createAuth } from '@/lib/auth';

import { projectSchema } from '../schema';
import { betterAuthComponent } from './auth';
import { procedure } from './procedure';
import { createProjectSchema, selectProjectSchema, updateProjectSchema } from './project.utils';
import { verify } from './utils/verify';

export const create = procedure.authed.external.mutation({
	args: createProjectSchema,
	handler: async (ctx, args) => {
		const auth = createAuth(ctx);

		const member = await auth.api.getActiveMember({
			headers: await betterAuthComponent.getHeaders(ctx),
		});

		if (!member || (member?.role !== 'admin' && member?.role !== 'owner')) {
			throw new ConvexError({
				message: 'User does not have permission',
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

export const update = procedure.authed.external.mutation({
	args: updateProjectSchema,
	handler: async (ctx, args) => {
		const auth = createAuth(ctx);

		const member = await auth.api.getActiveMember({
			headers: await betterAuthComponent.getHeaders(ctx),
		});

		if (!member || (member?.role !== 'admin' && member?.role !== 'owner')) {
			throw new ConvexError({
				message: 'User does not have permission',
				code: '403',
			});
		}

		await verify.patch({
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

// export const getManyByOrg = procedure.base.external.query({
// 	args: {},
// 	handler: async (ctx) => {},
// });

export const getFullProject = procedure.base.external.query({
	args: projectSchema
		.pick({
			slug: true,
		})
		.merge(
			z.object({
				orgSlug: z.string(),
			})
		),
	handler: async (ctx, args) => {
		// const auth = createAuth(ctx);

		const project = await ctx.db
			.query('project')
			.withIndex('by_orgSlug_slug', (q) => q.eq('orgSlug', args.orgSlug).eq('slug', args.slug))
			.unique();

		if (project?.private || !project) {
			throw new ConvexError({
				message: 'Project not found',
				code: '404',
			});
		}

		return selectProjectSchema.parse(project);
	},
});
