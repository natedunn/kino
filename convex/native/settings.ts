import { ConvexError, v } from 'convex/values';

import {
	orgNameSchema,
	orgSlugWriteSchema,
	projectDescriptionSchema,
	projectNameSchema,
	projectSlugWriteSchema,
	urlListSchema,
} from '../shared/validation';
import { internalQuery, mutation, query } from './_generated/server';
import { requireOrganizationManager, requireProjectAccess } from './access';
import { view } from './relay';
import { connectionView, installationView } from './relaySchema';
import { projectVisibility } from './schema';

const urlInput = v.object({ source: v.optional(v.string()), text: v.string(), url: v.string() });
export const projectFields = {
	id: v.id('projects'),
	name: v.string(),
	slug: v.string(),
	description: v.string(),
	visibility: projectVisibility,
	updatesFeaturedMode: v.union(v.literal('latest'), v.literal('manual')),
	urls: v.array(
		v.object({
			source: v.string(),
			text: v.string(),
			url: v.string(),
			verifiedAt: v.union(v.number(), v.null()),
		})
	),
};
const normalizeUrl = (url: string) => url.trim().replace(/\/+$/, '').toLowerCase();

export const updateProject = mutation({
	args: {
		id: v.id('projects'),
		name: v.string(),
		slug: v.string(),
		description: v.string(),
		visibility: projectVisibility,
		updatesFeaturedMode: v.union(v.literal('latest'), v.literal('manual')),
		urls: v.array(urlInput),
	},
	returns: v.object(projectFields),
	handler: async (ctx, args) => {
		const access = await requireProjectAccess(ctx, args.id);
		if (!access.permissions.canEditSettings) throw new ConvexError('FORBIDDEN');
		if (args.visibility === 'public') {
			const organization = await ctx.db.get('organizations', access.project.organizationId);
			if (organization?.visibility === 'private')
				throw new ConvexError('PROJECT_PUBLIC_REQUIRES_PUBLIC_ORGANIZATION');
		}
		if (
			access.isArchived &&
			(!access.permissions.canManageAccess || args.visibility === 'archived')
		)
			throw new ConvexError('PROJECT_ARCHIVED');
		if (args.visibility === 'archived' && !access.permissions.canManageAccess)
			throw new ConvexError('FORBIDDEN');
		const parsed = {
			name: projectNameSchema.safeParse(args.name),
			slug: projectSlugWriteSchema.safeParse(args.slug),
			description: projectDescriptionSchema.safeParse(args.description),
			urls: urlListSchema.safeParse(args.urls),
		};
		if (
			!parsed.name.success ||
			!parsed.slug.success ||
			!parsed.description.success ||
			!parsed.urls.success
		)
			throw new ConvexError('INVALID_ARGUMENT');
		const nextSlug = parsed.slug.data;
		const duplicate = await ctx.db
			.query('projects')
			.withIndex('by_organizationId_and_slug', (q) =>
				q.eq('organizationId', access.project.organizationId).eq('slug', nextSlug)
			)
			.unique();
		if (duplicate && duplicate._id !== args.id)
			throw new ConvexError({
				code: 'CONFLICT',
				appErrorCode: 'PROJECT_SLUG_TAKEN',
				appErrorValues: JSON.stringify({ slug: nextSlug }),
			});
		const connection = await ctx.db
			.query('relayConnections')
			.withIndex('by_projectId_and_deletedTime', (q) =>
				q.eq('projectId', args.id).eq('deletedTime', undefined)
			)
			.unique();
		const urls = parsed.urls.data.map((entry) => {
			const verified =
				entry.source === 'github' &&
				!!connection &&
				normalizeUrl(entry.url) === normalizeUrl(`https://github.com/${connection.repoFullName}`);
			const previous = access.project.urls?.find(
				(u) => u.source === 'github' && normalizeUrl(u.url) === normalizeUrl(entry.url)
			);
			return {
				...entry,
				source: verified ? 'github' : 'manual',
				verifiedAt: verified ? (previous?.verifiedAt ?? Date.now()) : null,
			};
		});
		const patch = {
			name: parsed.name.data,
			slug: parsed.slug.data,
			description: parsed.description.data,
			urls,
			visibility: args.visibility,
			updatesFeaturedMode: args.updatesFeaturedMode,
		};
		await ctx.db.patch('projects', args.id, patch);
		// All content/storage relations use immutable IDs. Only active Relay views
		// duplicate slugs; old pending OAuth states intentionally fail after rename.
		if (connection && connection.projectSlug !== patch.slug)
			await ctx.db.patch('relayConnections', connection._id, { projectSlug: patch.slug });
		return { id: args.id, ...patch };
	},
});

export const updateOrganization = mutation({
	args: { currentSlug: v.string(), name: v.string(), updatedSlug: v.optional(v.string()) },
	returns: v.object({ id: v.id('organizations'), name: v.string(), slug: v.string() }),
	handler: async (ctx, args) => {
		const org = await ctx.db
			.query('organizations')
			.withIndex('by_slug', (q) => q.eq('slug', args.currentSlug))
			.unique();
		if (!org) throw new ConvexError('ORGANIZATION_NOT_FOUND');
		await requireOrganizationManager(ctx, org._id);
		const name = orgNameSchema.safeParse(args.name),
			slug = orgSlugWriteSchema.safeParse(args.updatedSlug ?? org.slug);
		if (!name.success || !slug.success) throw new ConvexError('INVALID_ARGUMENT');
		if (slug.data !== org.slug) {
			const duplicate = await ctx.db
				.query('organizations')
				.withIndex('by_slug', (q) => q.eq('slug', slug.data))
				.unique();
			if (duplicate)
				throw new ConvexError({ code: 'CONFLICT', appErrorCode: 'ORGANIZATION_SLUG_TAKEN' });
			const installations = await ctx.db
				.query('relayInstallations')
				.withIndex('by_orgId', (q) => q.eq('orgId', org._id))
				.take(101);
			const connections = await ctx.db
				.query('relayConnections')
				.withIndex('by_orgId_and_deletedTime', (q) =>
					q.eq('orgId', org._id).eq('deletedTime', undefined)
				)
				.take(501);
			if (installations.length > 100 || connections.length > 500)
				throw new ConvexError('RELAY_CAPACITY');
			for (const row of installations)
				await ctx.db.patch('relayInstallations', row._id, { orgSlug: slug.data });
			for (const row of connections)
				await ctx.db.patch('relayConnections', row._id, { orgSlug: slug.data });
		}
		await ctx.db.patch('organizations', org._id, { name: name.data, slug: slug.data });
		return { id: org._id, name: name.data, slug: slug.data };
	},
});

export const githubImportInfo = query({
	args: { id: v.id('projects') },
	returns: v.object({ connected: v.boolean(), repoFullName: v.union(v.null(), v.string()) }),
	handler: async (ctx, { id }) => {
		const access = await requireProjectAccess(ctx, id);
		if (!access.permissions.canEditSettings) return { connected: false, repoFullName: null };
		const c = await ctx.db
			.query('relayConnections')
			.withIndex('by_projectId_and_deletedTime', (q) =>
				q.eq('projectId', id).eq('deletedTime', undefined)
			)
			.unique();
		return { connected: !!c, repoFullName: c?.repoFullName ?? null };
	},
});

export const githubImportContext = internalQuery({
	args: { id: v.id('projects') },
	returns: v.object({ connection: connectionView, installation: installationView }),
	handler: async (ctx, { id }) => {
		const access = await requireProjectAccess(ctx, id);
		if (!access.permissions.canEditSettings) throw new ConvexError('FORBIDDEN');
		const c = await ctx.db
			.query('relayConnections')
			.withIndex('by_projectId_and_deletedTime', (q) =>
				q.eq('projectId', id).eq('deletedTime', undefined)
			)
			.unique();
		if (!c) throw new ConvexError('NOT_FOUND');
		const i = await ctx.db.get('relayInstallations', c.githubInstallationId);
		if (!i || i.status !== 'active') throw new ConvexError('GITHUB_INSTALLATION_STALE');
		return { connection: view(c), installation: view(i) };
	},
});
