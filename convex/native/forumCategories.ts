import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

import { ConvexError, v } from 'convex/values';

import { boardIconSchema, VALIDATION_LIMITS } from '../shared/validation';
import { internal } from './_generated/api';
import { internalMutation, mutation, query } from './_generated/server';
import { assertProjectWritable, requireProjectAccess, resolveProjectAccess } from './access';
import { forumCategoryFormat, forumPostingPolicy } from './schema';

export const MAX_CATEGORIES = 25;
const REASSIGN_BATCH_SIZE = 100;
const BACKFILL_BATCH_SIZE = 50;

// Seeded into every project. Projects rename, reorder, add and remove freely.
export const DEFAULT_CATEGORIES = [
	{
		name: 'General',
		slug: 'general',
		description: 'Chat about anything related to this project.',
		icon: 'chat',
		format: 'open',
		postingPolicy: 'everyone',
	},
	{
		name: 'Q&A',
		slug: 'q-a',
		description: 'Ask the community for help. Mark the reply that answers your question.',
		icon: 'interview',
		format: 'qa',
		postingPolicy: 'everyone',
	},
	{
		name: 'Ideas',
		slug: 'ideas',
		description: 'Share and talk through ideas before they become feedback.',
		icon: 'lightbulb',
		format: 'open',
		postingPolicy: 'everyone',
	},
	{
		name: 'Show and tell',
		slug: 'show-and-tell',
		description: 'Show off something you made with this project.',
		icon: 'sparkle',
		format: 'open',
		postingPolicy: 'everyone',
	},
	{
		name: 'Announcements',
		slug: 'announcements',
		description: 'News from the project team.',
		icon: 'megaphone',
		format: 'open',
		postingPolicy: 'team',
	},
] as const satisfies ReadonlyArray<
	Pick<
		Doc<'forumCategories'>,
		'name' | 'slug' | 'description' | 'icon' | 'format' | 'postingPolicy'
	>
>;

export const categoryView = v.object({
	id: v.id('forumCategories'),
	name: v.string(),
	slug: v.string(),
	description: v.union(v.string(), v.null()),
	icon: v.union(v.string(), v.null()),
	format: forumCategoryFormat,
	postingPolicy: forumPostingPolicy,
});

export function toCategoryView(category: Doc<'forumCategories'>) {
	return {
		id: category._id,
		name: category.name,
		slug: category.slug,
		description: category.description ?? null,
		icon: category.icon ?? null,
		format: category.format,
		postingPolicy: category.postingPolicy,
	};
}

/** Live categories in display order. Bounded by MAX_CATEGORIES. */
export async function liveCategories(ctx: QueryCtx, projectId: Id<'projects'>) {
	const rows = await ctx.db
		.query('forumCategories')
		.withIndex('by_projectId_and_position', (q) => q.eq('projectId', projectId))
		.take(MAX_CATEGORIES * 2);
	return rows.filter((row) => row.deletingAt === undefined);
}

export async function seedDefaultCategories(ctx: MutationCtx, projectId: Id<'projects'>) {
	const existing = await ctx.db
		.query('forumCategories')
		.withIndex('by_projectId_and_position', (q) => q.eq('projectId', projectId))
		.first();
	if (existing) return;
	for (const [position, category] of DEFAULT_CATEGORIES.entries())
		await ctx.db.insert('forumCategories', { projectId, position, ...category });
}

function validSlug(value: string) {
	return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(value);
}

function parseFields(args: { name: string; slug: string; description?: string; icon?: string }) {
	const name = args.name.trim();
	const slug = args.slug.trim().toLowerCase();
	const description = args.description?.trim() ?? '';
	const icon = boardIconSchema.safeParse(args.icon ?? '');
	if (
		!name ||
		name.length > VALIDATION_LIMITS.forumCategoryName ||
		!validSlug(slug) ||
		description.length > VALIDATION_LIMITS.forumCategoryDescription ||
		!icon.success
	)
		throw new ConvexError('INVALID_CATEGORY');
	return { name, slug, description: description || undefined, icon: icon.data || undefined };
}

async function managedProject(ctx: MutationCtx, projectId: Id<'projects'>) {
	const access = await requireProjectAccess(ctx, projectId);
	if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
	assertProjectWritable(access);
	return access;
}

async function assertSlugFree(
	ctx: MutationCtx,
	projectId: Id<'projects'>,
	slug: string,
	except?: Id<'forumCategories'>
) {
	const existing = await ctx.db
		.query('forumCategories')
		.withIndex('by_projectId_and_slug', (q) => q.eq('projectId', projectId).eq('slug', slug))
		.take(2);
	if (existing.some((row) => row._id !== except && row.deletingAt === undefined))
		throw new ConvexError('CATEGORY_SLUG_TAKEN');
}

export const list = query({
	args: { projectId: v.id('projects') },
	returns: v.union(v.null(), v.array(categoryView)),
	handler: async (ctx, { projectId }) => {
		const access = await resolveProjectAccess(ctx, projectId);
		if (!access.project) return null;
		return (await liveCategories(ctx, projectId)).map(toCategoryView);
	},
});

export const create = mutation({
	args: {
		projectId: v.id('projects'),
		name: v.string(),
		slug: v.string(),
		description: v.optional(v.string()),
		icon: v.optional(v.string()),
		format: forumCategoryFormat,
		postingPolicy: forumPostingPolicy,
	},
	returns: v.id('forumCategories'),
	handler: async (ctx, args) => {
		await managedProject(ctx, args.projectId);
		const fields = parseFields(args);
		const categories = await liveCategories(ctx, args.projectId);
		if (categories.length >= MAX_CATEGORIES) throw new ConvexError('CATEGORY_LIMIT');
		await assertSlugFree(ctx, args.projectId, fields.slug);
		const position = (categories.at(-1)?.position ?? -1) + 1;
		return ctx.db.insert('forumCategories', {
			projectId: args.projectId,
			...fields,
			format: args.format,
			postingPolicy: args.postingPolicy,
			position,
		});
	},
});

export const update = mutation({
	args: {
		categoryId: v.id('forumCategories'),
		name: v.string(),
		slug: v.string(),
		description: v.optional(v.string()),
		icon: v.optional(v.string()),
		format: forumCategoryFormat,
		postingPolicy: forumPostingPolicy,
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const category = await ctx.db.get('forumCategories', args.categoryId);
		if (!category || category.deletingAt !== undefined) throw new ConvexError('NOT_FOUND');
		await managedProject(ctx, category.projectId);
		const fields = parseFields(args);
		await assertSlugFree(ctx, category.projectId, fields.slug, category._id);
		await ctx.db.patch('forumCategories', category._id, {
			...fields,
			format: args.format,
			postingPolicy: args.postingPolicy,
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const reorder = mutation({
	args: {
		projectId: v.id('projects'),
		categoryIds: v.array(v.id('forumCategories')),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await managedProject(ctx, args.projectId);
		const categories = await liveCategories(ctx, args.projectId);
		const ids = new Set(categories.map((category) => category._id));
		if (
			args.categoryIds.length !== ids.size ||
			new Set(args.categoryIds).size !== ids.size ||
			args.categoryIds.some((id) => !ids.has(id))
		)
			throw new ConvexError('INVALID_CATEGORY_ORDER');
		for (const [position, id] of args.categoryIds.entries())
			await ctx.db.patch('forumCategories', id, { position });
		return null;
	},
});

// Deleting a category moves its topics to another one; nothing is lost.
export const remove = mutation({
	args: {
		categoryId: v.id('forumCategories'),
		moveToCategoryId: v.id('forumCategories'),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		if (args.categoryId === args.moveToCategoryId) throw new ConvexError('INVALID_CATEGORY');
		const [category, target] = await Promise.all([
			ctx.db.get('forumCategories', args.categoryId),
			ctx.db.get('forumCategories', args.moveToCategoryId),
		]);
		if (!category || category.deletingAt !== undefined) throw new ConvexError('NOT_FOUND');
		if (!target || target.deletingAt !== undefined || target.projectId !== category.projectId)
			throw new ConvexError('INVALID_CATEGORY');
		await managedProject(ctx, category.projectId);
		await ctx.db.patch('forumCategories', category._id, { deletingAt: Date.now() });
		await ctx.scheduler.runAfter(0, internal.forumCategories.reassignBatch, args);
		return null;
	},
});

export const reassignBatch = internalMutation({
	args: {
		categoryId: v.id('forumCategories'),
		moveToCategoryId: v.id('forumCategories'),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const category = await ctx.db.get('forumCategories', args.categoryId);
		if (!category || category.deletingAt === undefined) return null;
		const topics = await ctx.db
			.query('forumTopics')
			.withIndex('by_categoryId', (q) => q.eq('categoryId', args.categoryId))
			.take(REASSIGN_BATCH_SIZE);
		for (const topic of topics)
			await ctx.db.patch('forumTopics', topic._id, { categoryId: args.moveToCategoryId });
		if (topics.length === REASSIGN_BATCH_SIZE)
			await ctx.scheduler.runAfter(0, internal.forumCategories.reassignBatch, args);
		else await ctx.db.delete('forumCategories', category._id);
		return null;
	},
});

/**
 * Seeds default categories into projects created before categories existed and
 * files their uncategorized topics under the first category. Run once per
 * deployment: `npx convex run forumCategories:backfillDefaults`.
 */
export const backfillDefaults = internalMutation({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const result = await ctx.db
			.query('projects')
			.paginate({ numItems: BACKFILL_BATCH_SIZE, cursor: args.cursor ?? null });
		for (const project of result.page) {
			if (project.deletingAt !== undefined) continue;
			await seedDefaultCategories(ctx, project._id);
			await ctx.scheduler.runAfter(0, internal.forumCategories.fileUncategorized, {
				projectId: project._id,
			});
		}
		if (!result.isDone)
			await ctx.scheduler.runAfter(0, internal.forumCategories.backfillDefaults, {
				cursor: result.continueCursor,
			});
		return null;
	},
});

export const fileUncategorized = internalMutation({
	args: { projectId: v.id('projects') },
	returns: v.null(),
	handler: async (ctx, { projectId }) => {
		const first = (await liveCategories(ctx, projectId)).at(0);
		if (!first) return null;
		const topics = await ctx.db
			.query('forumTopics')
			.withIndex('by_projectId', (q) => q.eq('projectId', projectId))
			.filter((q) => q.eq(q.field('categoryId'), undefined))
			.take(REASSIGN_BATCH_SIZE);
		for (const topic of topics)
			await ctx.db.patch('forumTopics', topic._id, { categoryId: first._id });
		if (topics.length === REASSIGN_BATCH_SIZE)
			await ctx.scheduler.runAfter(0, internal.forumCategories.fileUncategorized, {
				projectId,
			});
		return null;
	},
});
