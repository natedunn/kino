import { v } from 'convex/values';

import { query } from './_generated/server';
import { resolveProjectAccess } from './access';
import { projectThemePalette, projectThemePreset, projectVisibility } from './schema';

const projectPermissionsValidator = v.object({
	canView: v.boolean(),
	canManageContent: v.boolean(),
	canEditSettings: v.boolean(),
	canManageAccess: v.boolean(),
	canManageIntegrations: v.boolean(),
	canDelete: v.boolean(),
});
const projectListItemValidator = v.object({
	description: v.string(),
	id: v.id('projects'),
	name: v.string(),
	slug: v.string(),
	visibility: projectVisibility,
});

export const getBySlugs = query({
	args: { organizationSlug: v.string(), projectSlug: v.string() },
	returns: v.union(
		v.null(),
		v.object({
			publishedTheme: v.union(
				v.null(),
				v.object({
					version: v.number(),
					presetId: projectThemePreset,
					light: projectThemePalette,
					dark: projectThemePalette,
				})
			),
			organization: v.object({
				id: v.id('organizations'),
				name: v.string(),
				slug: v.string(),
				visibility: v.union(v.literal('public'), v.literal('private')),
			}),
			permissions: projectPermissionsValidator,
			project: v.object({
				createdAt: v.number(),
				description: v.string(),
				urls: v.array(
					v.object({
						source: v.string(),
						text: v.string(),
						url: v.string(),
						verifiedAt: v.union(v.null(), v.number()),
					})
				),
				id: v.id('projects'),
				name: v.string(),
				slug: v.string(),
				visibility: projectVisibility,
				updatesFeaturedMode: v.union(v.literal('latest'), v.literal('manual')),
			}),
		})
	),
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
	returns: v.array(projectListItemValidator),
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
