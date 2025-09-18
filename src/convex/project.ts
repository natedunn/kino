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

import { authComponent, createAuth } from './auth';
import schema from './schema';
import { zAuthedMutation, zQuery } from './utils/functions';
import { getProjectUserDetails } from './utils/queries/getProjectUserDetails';
import { triggers } from './utils/trigger';
import { verify } from './utils/verify';

export const create = zAuthedMutation({
	args: createProjectSchema,
	handler: async (ctx, args) => {
		const headers = await authComponent.getHeaders(ctx);

		if (headers) {
			const member = await createAuth(ctx).api.getActiveMember({
				headers,
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
		} else {
			throw new ConvexError({
				message: 'Headers not defined',
				code: '500',
			});
		}
	},
});

export const update = zAuthedMutation({
	args: updateProjectSchema,
	handler: async (ctx, args) => {
		const headers = await authComponent.getHeaders(ctx);

		let member = null;

		if (headers) {
			member = await createAuth(ctx).api.getActiveMember({
				headers,
			});
		}

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

export const getManyByOrg = zQuery({
	args: {
		orgSlug: z.string(),
		limit: z.number().optional(),
	},
	handler: async (ctx, args) => {
		const auth = createAuth(ctx);

		const memberOrgs = await auth.api
			.listOrganizations({
				headers: await authComponent.getHeaders(ctx),
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

		return (await mergedProjects).length <= 0 ? null : mergedProjects;
	},
});

export const getDetails = zQuery({
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
		const {
			project,
			permissions: { canView },
		} = await getProjectUserDetails(ctx, {
			projectSlug: args.slug,
		});

		if (!project) {
			throw new ConvexError({
				message: 'Project not found',
				code: '404',
			});
		}

		if (!canView) {
			console.warn('Authenticated user is unable to view private project');
			return null;
		}

		return {
			project: selectProjectSchema.parse(project),
		};
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
