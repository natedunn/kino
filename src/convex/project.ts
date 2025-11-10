import { mergedStream, stream } from 'convex-helpers/server/stream';
import { ConvexError, v } from 'convex/values';

import { zodToConvex } from '@/_modules/zod4';
import { defaultFeedbackBoards } from '@/config/defaults';
import {
	createProjectSchema,
	selectProjectSchema,
	updateProjectSchema,
} from '@/convex/schema/project.schema';

import { components } from './_generated/api';
import { authComponent, createAuth } from './auth';
import schema from './schema';
import { authedMutation, mutation, query } from './utils/functions';
import { getProjectUserDetails } from './utils/queries/getProjectUserDetails';
import { triggers } from './utils/trigger';
import { verify } from './utils/verify';

export const create = mutation({
	args: zodToConvex(createProjectSchema),
	handler: async (ctx, args) => {
		await verify.auth(ctx, {
			throw: true,
		});

		const validatedArgs = createProjectSchema.parse(args);

		const orgDetails = await ctx.runQuery(components.betterAuth.org.getDetails, {
			slug: args.orgSlug,
		});

		if (!orgDetails) {
			throw new ConvexError({
				message: 'Organization not found',
				code: '404',
			});
		}

		if (!orgDetails.permissions.canEdit) {
			throw new ConvexError({
				message: 'User does not have permission',
				code: '403',
			});
		}

		await verify.insert({
			ctx,
			tableName: 'project',
			data: validatedArgs,
			onFail: ({ uniqueRow }) => {
				throw new ConvexError({
					message: `A project with the slug of '${uniqueRow?.existingData.slug}' already exists for this organization.`,
				});
			},
		});
	},
});

export const update = authedMutation({
	args: zodToConvex(updateProjectSchema),
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
					message: `A project with the slug of '${uniqueRow?.existingData.slug}' already exists for this organization.`,
				});
			},
		});
	},
});

export const getManyByOrg = query({
	args: {
		orgSlug: v.string(),
		limit: v.optional(v.number()),
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

export const getDetails = query({
	args: zodToConvex(
		selectProjectSchema.pick({
			orgSlug: true,
			slug: true,
		})
	),
	handler: async (ctx, args) => {
		const projectDetails = await getProjectUserDetails(ctx, {
			projectSlug: args.slug,
		});

		if (!projectDetails.project) {
			throw new ConvexError({
				message: 'Project not found',
				code: '404',
			});
		}

		if (!projectDetails.permissions.canView) {
			console.warn('Authenticated user is unable to view private project');
			return null;
		}

		return projectDetails;
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
