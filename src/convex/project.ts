import { mergedStream, stream } from 'convex-helpers/server/stream';
import { zodToConvex } from 'convex-helpers/server/zod4';
import { ConvexError, v } from 'convex/values';
import { kebabCase } from 'scule';

import { defaultFeedbackBoards } from '@/config/defaults';
import {
	createProjectSchema,
	selectProjectSchema,
	updateProjectSchema,
} from '@/convex/schema/project.schema';

import { authComponent, createAuth } from './auth';
import { verifyOrgAccess } from './org.lib';
import { verifyProjectAccess } from './project.lib';
import schema from './schema';
import { authedMutation, mutation, query } from './utils/functions';
import { triggers } from './utils/trigger';
import { verify } from './utils/verify';

export const create = mutation({
	args: zodToConvex(createProjectSchema),
	handler: async (ctx, args) => {
		const {
			profile,
			permissions: { canCreate },
		} = await verifyOrgAccess(ctx, {
			slug: args.orgSlug,
		});

		if (!profile) {
			throw new ConvexError({
				message: 'No user authenticated.',
				code: '41',
			});
		}

		if (!canCreate) {
			throw new ConvexError({
				message: 'User does not have permission to create a project',
				code: '403',
			});
		}

		const id = await verify.insert({
			ctx,
			tableName: 'project',
			data: args,
			onFail: ({ uniqueRow }) => {
				throw new ConvexError({
					message: `A project with the slug of '${uniqueRow?.existingData?.slug}' already exists for this organization.`,
				});
			},
		});

		await verify.insert({
			ctx,
			tableName: 'projectMember',
			data: {
				projectId: id,
				profileId: profile._id,
				role: 'admin',
				projectSlug: args.slug,
				projectVisibility: args.visibility,
			},
		});
	},
});

export const update = authedMutation({
	args: zodToConvex(updateProjectSchema),
	handler: async (ctx, args) => {
		const { auth, headers } = await authComponent.getAuth(createAuth, ctx);

		let member = null;

		if (headers) {
			member = await auth.api.getActiveMember({
				headers,
			});
		}

		if (!member || (member?.role !== 'admin' && member?.role !== 'owner')) {
			throw new ConvexError({
				message: 'User does not have permission',
				code: '403',
			});
		}

		await verify.patch(ctx, 'project', args._id, args, {
			onFail: ({ uniqueRow }) => {
				throw new ConvexError({
					message: `A project with the slug of '${uniqueRow?.existingData?.slug}' already exists for this organization.`,
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
		const { auth } = await authComponent.getAuth(createAuth, ctx);

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
		// console.log('project.getDetails args >>>>', args);

		if (args.orgSlug === 'tanstack-start' || args.slug === 'styles.css') {
			return null;
		}

		const projectDetails = await verifyProjectAccess(ctx, {
			slug: args.slug,
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
	// Change visibility
	if (change.operation === 'update') {
		const projectMembers = await ctx.db
			.query('projectMember')
			.withIndex('by_projectId', (q) => q.eq('projectId', change.oldDoc._id))
			.collect();

		projectMembers.forEach(async (profile) => {
			await ctx.db.patch(profile._id, {
				projectSlug: change.newDoc.slug,
				projectVisibility: change.newDoc.visibility,
			});
		});
	}

	if (change.operation === 'insert') {
		// Add default boards
		defaultFeedbackBoards.forEach(async (boardName) => {
			const getDefaultIcon = () => {
				switch (boardName) {
					case 'Bugs':
						return 'bug';
						break;
					case 'Improvements':
						return 'chart-up';
						break;
					case 'Feature Requests':
						return 'lightbulb';
						break;
					default:
						return 'box';
				}
			};

			await ctx.db.insert('feedbackBoard', {
				name: boardName,
				projectId: change.newDoc._id,
				icon: getDefaultIcon(),
				slug: kebabCase(boardName),
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
