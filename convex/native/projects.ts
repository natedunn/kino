import { v } from 'convex/values';

import { query } from './_generated/server';
import { resolveProjectAccess } from './access';

export const getBySlugs = query({
	args: { organizationSlug: v.string(), projectSlug: v.string() },
	handler: async (ctx, args) => {
		const organization = await ctx.db
			.query('organizations')
			.withIndex('by_slug', (q) => q.eq('slug', args.organizationSlug))
			.unique();
		if (!organization) return null;
		const project = await ctx.db
			.query('projects')
			.withIndex('by_organizationId_and_slug', (q) =>
				q.eq('organizationId', organization._id).eq('slug', args.projectSlug)
			)
			.unique();
		if (!project) return null;
		const access = await resolveProjectAccess(ctx, project._id);
		if (!access.project) return null;
		const theme = await ctx.db
			.query('projectThemes')
			.withIndex('by_projectId', (q) => q.eq('projectId', project._id))
			.unique();
		return {
			publishedTheme: theme
				? {
						version: theme.version,
						presetId: theme.publishedPresetId,
						light: theme.publishedLight,
						dark: theme.publishedDark,
					}
				: null,
			organization: {
				id: organization._id,
				name: organization.name,
				slug: organization.slug,
				visibility: organization.visibility,
			},
			permissions: access.permissions,
			project: {
				createdAt: project._creationTime,
				description: project.description ?? '',
				urls: project.urls ?? [],
				id: project._id,
				name: project.name,
				slug: project.slug,
				visibility: project.visibility,
				updatesFeaturedMode: project.updatesFeaturedMode ?? 'latest',
			},
		};
	},
});

export const listByOrganization = query({
	args: { organizationId: v.id('organizations'), limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const limit = Math.max(1, Math.min(args.limit ?? 50, 100));
		const projects = await ctx.db
			.query('projects')
			.withIndex('by_organizationId', (q) => q.eq('organizationId', args.organizationId))
			.take(limit);
		const visible = await Promise.all(
			projects.map(async (project) => {
				const access = await resolveProjectAccess(ctx, project._id);
				return access.project
					? {
							description: project.description ?? '',
							id: project._id,
							name: project.name,
							slug: project.slug,
							visibility: project.visibility,
						}
					: null;
			})
		);
		return visible.filter((project) => project !== null);
	},
});
