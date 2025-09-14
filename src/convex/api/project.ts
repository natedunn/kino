import { mergedStream, stream } from 'convex-helpers/server/stream';
import { ConvexError } from 'convex/values';
import z from 'zod';

import { defaultFeedbackBoards } from '@/config/defaults';
import {
	createProjectSchema,
	projectSchema,
	selectProjectSchema,
	updateProjectSchema,
} from '@/convex/schema/project.schema';
import { createAuth } from '@/lib/auth';

import schema from '../schema';
import { betterAuthComponent } from './auth';
import { procedure } from './procedure';
import { getProjectUserData } from './utils/queries/getProjectUserData';
import { triggers } from './utils/trigger';
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

export const getManyByOrg = procedure.base.external.query({
	args: {
		orgSlug: z.string(),
		limit: z.number().optional(),
	},
	handler: async (ctx, args) => {
		const auth = createAuth(ctx);

		const memberOrgs = await auth.api
			.listOrganizations({
				headers: await betterAuthComponent.getHeaders(ctx),
			})
			.catch(() => null);

		let publicProjects = stream(ctx.db, schema)
			.query('project')
			.withIndex('by_orgSlug_visibility_updatedAt', (q) =>
				q.eq('orgSlug', args.orgSlug).eq('visibility', 'public')
			);
		let privateProjects: typeof publicProjects | undefined;
		let archivedProjects: typeof publicProjects | undefined;

		if (memberOrgs && memberOrgs.find((org) => org.slug === args.orgSlug)) {
			privateProjects = stream(ctx.db, schema)
				.query('project')
				.withIndex('by_orgSlug_visibility_updatedAt', (q) =>
					q.eq('orgSlug', args.orgSlug).eq('visibility', 'private')
				);

			archivedProjects = stream(ctx.db, schema)
				.query('project')
				.withIndex('by_orgSlug_visibility_updatedAt', (q) =>
					q.eq('orgSlug', args.orgSlug).eq('visibility', 'archived')
				);
		}

		const mergedProjects = mergedStream(
			[
				publicProjects,
				...(privateProjects ? [privateProjects] : []),
				...(archivedProjects ? [archivedProjects] : []),
			],
			['updatedTime']
		).take(args.limit ?? 10);

		return mergedProjects;
	},
});

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
		const project = await ctx.db
			.query('project')
			.withIndex('by_orgSlug_slug', (q) => q.eq('orgSlug', args.orgSlug).eq('slug', args.slug))
			.unique();

		if (!project) {
			console.warn('No project found');
			return null;
		}

		const isProjectAdmin = await getProjectUserData(ctx, {
			projectId: project._id,
		});

		if (project?.visibility === 'private' && !isProjectAdmin) {
			console.warn('Authenticated user is unable to view private project');
			return null;
		}

		const data = {
			isProjectAdmin,
			project: selectProjectSchema.parse(project),
		};

		console.log(data);

		return data;
	},
});

triggers.register('project', async (ctx, change) => {
	if (change.operation === 'insert') {
		defaultFeedbackBoards.forEach(async (boardName) => {
			await ctx.db.insert('feedbackBoard', {
				name: boardName,
				projectId: change.newDoc._id,
			});
		});
	}
	if (change.operation === 'delete') {
		const boards = await ctx.db
			.query('feedbackBoard')
			.withIndex('by_projectId', (q) => q.eq('projectId', change.oldDoc._id))
			.collect();

		boards.forEach(async (board) => {
			await ctx.db.delete(board._id);
		});
	}
});
