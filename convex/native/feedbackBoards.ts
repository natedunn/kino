import { ConvexError, v } from 'convex/values';

import {
	boardDescriptionSchema,
	boardIconSchema,
	boardNameSchema,
	projectSlugWriteSchema,
} from '../shared/validation';
import { internal } from './_generated/api';
import { internalMutation, mutation, query } from './_generated/server';
import { assertProjectWritable, requireProjectAccess, resolveProjectAccess } from './access';
import { deleteChildBatch } from './feedback';

const boardView = v.object({
	id: v.id('feedbackBoards'),
	name: v.string(),
	slug: v.string(),
	description: v.union(v.string(), v.null()),
	icon: v.union(v.string(), v.null()),
});

function validSlug(value: string) {
	return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(value);
}

export const get = query({
	args: { id: v.id('feedbackBoards'), orgSlug: v.string(), projectSlug: v.string() },
	returns: v.union(boardView, v.null()),
	handler: async (ctx, args) => {
		const board = await ctx.db.get('feedbackBoards', args.id);
		if (!board || board.deletingAt !== undefined) return null;
		const access = await resolveProjectAccess(ctx, board.projectId);
		const org =
			access.project && (await ctx.db.get('organizations', access.project.organizationId));
		if (!access.project || access.project.slug !== args.projectSlug || org?.slug !== args.orgSlug)
			return null;
		return {
			id: board._id,
			name: board.name,
			slug: board.slug,
			description: board.description ?? null,
			icon: board.icon ?? null,
		};
	},
});

export const update = mutation({
	args: {
		id: v.id('feedbackBoards'),
		orgSlug: v.string(),
		projectSlug: v.string(),
		name: v.string(),
		slug: v.string(),
		description: v.optional(v.string()),
		icon: v.optional(v.string()),
	},
	returns: v.object({ success: v.boolean() }),
	handler: async (ctx, args) => {
		const board = await ctx.db.get('feedbackBoards', args.id);
		if (!board || board.deletingAt !== undefined) throw new ConvexError('NOT_FOUND');
		const access = await requireProjectAccess(ctx, board.projectId);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		assertProjectWritable(access);
		const org = await ctx.db.get('organizations', access.project.organizationId);
		if (access.project.slug !== args.projectSlug || org?.slug !== args.orgSlug)
			throw new ConvexError('NOT_FOUND');
		const name = boardNameSchema.safeParse(args.name);
		const slug = projectSlugWriteSchema.safeParse(args.slug);
		const description = boardDescriptionSchema.safeParse(args.description ?? '');
		const icon = boardIconSchema.safeParse(args.icon ?? '');
		if (!name.success || !slug.success || !description.success || !icon.success)
			throw new ConvexError({ code: 'BAD_REQUEST' });
		const existing = await ctx.db
			.query('feedbackBoards')
			.withIndex('by_projectId_and_slug', (q) =>
				q.eq('projectId', board.projectId).eq('slug', slug.data)
			)
			.unique();
		if (existing && existing._id !== board._id) throw new ConvexError({ code: 'CONFLICT' });
		await ctx.db.patch('feedbackBoards', board._id, {
			name: name.data,
			slug: slug.data,
			description: description.data || undefined,
			icon: icon.data || undefined,
			updatedAt: Date.now(),
		});
		return { success: true };
	},
});

export const remove = mutation({
	args: { boardId: v.id('feedbackBoards'), projectId: v.id('projects') },
	returns: v.object({ success: v.boolean() }),
	handler: async (ctx, { boardId, projectId }) => {
		const access = await requireProjectAccess(ctx, projectId);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		assertProjectWritable(access);
		const board = await ctx.db.get('feedbackBoards', boardId);
		if (!board || board.projectId !== projectId) throw new ConvexError('NOT_FOUND');
		if (board.deletingAt !== undefined) return { success: true };
		await ctx.db.patch('feedbackBoards', boardId, { deletingAt: Date.now() });
		await ctx.scheduler.runAfter(0, internal.feedbackBoards.purge, { boardId });
		return { success: true };
	},
});

// One feedback and one bounded child batch per transaction. Tombstones fence
// readers/writers while even high-fanout feedback is removed in the background.
export const purge = internalMutation({
	args: { boardId: v.id('feedbackBoards') },
	returns: v.null(),
	handler: async (ctx, { boardId }) => {
		const board = await ctx.db.get('feedbackBoards', boardId);
		if (!board || board.deletingAt === undefined) return null;
		const feedback = await ctx.db
			.query('feedback')
			.withIndex('by_boardId', (q) => q.eq('boardId', boardId))
			.first();
		if (!feedback) {
			await ctx.db.delete('feedbackBoards', boardId);
			return null;
		}
		if (!(await deleteChildBatch(ctx, feedback._id))) {
			const job = await ctx.db
				.query('feedbackDeletionJobs')
				.withIndex('by_feedbackId', (q) => q.eq('feedbackId', feedback._id))
				.unique();
			if (job) await ctx.db.delete('feedbackDeletionJobs', job._id);
			await ctx.db.delete('feedback', feedback._id);
		}
		await ctx.scheduler.runAfter(0, internal.feedbackBoards.purge, { boardId });
		return null;
	},
});

export const list = query({
	args: { projectId: v.id('projects') },
	returns: v.union(v.array(boardView), v.null()),
	handler: async (ctx, { projectId }) => {
		const access = await resolveProjectAccess(ctx, projectId);
		if (!access.project) return null;
		const boards = await ctx.db
			.query('feedbackBoards')
			.withIndex('by_projectId', (q) => q.eq('projectId', projectId))
			.take(200);
		return boards
			.filter((board) => board.deletingAt === undefined)
			.map((board) => ({
				id: board._id,
				description: board.description ?? null,
				icon: board.icon ?? null,
				name: board.name,
				slug: board.slug,
			}));
	},
});

export const create = mutation({
	args: {
		projectId: v.id('projects'),
		name: v.string(),
		slug: v.string(),
		description: v.optional(v.string()),
		icon: v.optional(v.string()),
	},
	returns: v.id('feedbackBoards'),
	handler: async (ctx, args) => {
		const access = await requireProjectAccess(ctx, args.projectId);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		assertProjectWritable(access);
		const name = args.name.trim();
		const slug = args.slug.trim().toLowerCase();
		if (
			!boardNameSchema.safeParse(name).success ||
			!projectSlugWriteSchema.safeParse(slug).success ||
			!boardDescriptionSchema.safeParse(args.description ?? '').success ||
			!boardIconSchema.safeParse(args.icon ?? '').success ||
			!validSlug(slug)
		)
			throw new ConvexError({ code: 'BAD_REQUEST' });
		const boards = await ctx.db
			.query('feedbackBoards')
			.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
			.take(200);
		if (boards.length >= 200) throw new ConvexError({ code: 'BAD_REQUEST' });
		if (
			await ctx.db
				.query('feedbackBoards')
				.withIndex('by_projectId_and_slug', (q) =>
					q.eq('projectId', args.projectId).eq('slug', slug)
				)
				.unique()
		)
			throw new ConvexError({ code: 'CONFLICT' });
		return ctx.db.insert('feedbackBoards', {
			projectId: args.projectId,
			name,
			slug,
			...(args.description?.trim() ? { description: args.description.trim() } : {}),
			...(args.icon?.trim() ? { icon: args.icon.trim() } : {}),
		});
	},
});
