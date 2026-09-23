import type {
	ProjectThemeInput,
	ProjectThemePalette,
	ProjectThemePresetId,
} from '../shared/project-theme';

import { ConvexError, v } from 'convex/values';

import {
	isCuratedProjectTheme,
	normalizeProjectThemePalette,
	PROJECT_THEME_VERSION,
	validateProjectTheme,
} from '../shared/project-theme';
import { mutation, query } from './_generated/server';
import { assertProjectWritable, resolveProjectAccess } from './access';
import { requireCurrentUser } from './identity';

const colorValidator = v.string();
const paletteValidator = v.object({
	background: colorValidator,
	foreground: colorValidator,
	primary: colorValidator,
	primaryForeground: colorValidator,
	surface: colorValidator,
	surfaceForeground: colorValidator,
});
const presetValidator = v.union(
	v.literal('kino'),
	v.literal('red'),
	v.literal('orange'),
	v.literal('golden'),
	v.literal('forest'),
	v.literal('teal'),
	v.literal('purple'),
	v.literal('sunset'),
	v.literal('monochrome'),
	v.literal('custom')
);
const themeValidator = v.object({
	dark: paletteValidator,
	light: paletteValidator,
	presetId: presetValidator,
	version: v.literal(PROJECT_THEME_VERSION),
});

async function requireEditableProject(
	ctx: Parameters<typeof resolveProjectAccess>[0],
	projectId: Parameters<typeof resolveProjectAccess>[1]
) {
	const user = await requireCurrentUser(ctx);
	const access = await resolveProjectAccess(ctx, projectId);
	if (!access.project) throw new ConvexError('PROJECT_NOT_FOUND');
	if (!access.permissions.canEditSettings) throw new ConvexError('FORBIDDEN');
	assertProjectWritable(access);
	return { access, user };
}

async function getThemeRow(
	ctx: Parameters<typeof resolveProjectAccess>[0],
	projectId: Parameters<typeof resolveProjectAccess>[1]
) {
	return ctx.db
		.query('projectThemes')
		.withIndex('by_projectId', (q) => q.eq('projectId', projectId))
		.unique();
}

function normalizeTheme(input: {
	dark: ProjectThemePalette;
	light: ProjectThemePalette;
	presetId: ProjectThemePresetId;
}): ProjectThemeInput {
	const dark = normalizeProjectThemePalette(input.dark);
	const light = normalizeProjectThemePalette(input.light);
	if (!dark || !light) throw new ConvexError('INVALID_THEME_COLOR');
	const theme: ProjectThemeInput = {
		dark,
		light,
		presetId: input.presetId,
		version: PROJECT_THEME_VERSION,
	};
	if (validateProjectTheme(theme).length > 0) throw new ConvexError('INVALID_THEME_CONTRAST');
	return theme;
}

export const getEditorState = query({
	args: { projectId: v.id('projects') },
	returns: v.object({
		canUseCustomAccent: v.boolean(),
		publishedRevision: v.number(),
		publishedTheme: v.union(v.null(), themeValidator),
		publishedTime: v.union(v.null(), v.number()),
	}),
	handler: async (ctx, { projectId }) => {
		const [{ user }, row] = await Promise.all([
			requireEditableProject(ctx, projectId),
			getThemeRow(ctx, projectId),
		]);
		return {
			canUseCustomAccent: user.systemRole === 'system:admin',
			publishedRevision: row?.publishedRevision ?? 0,
			publishedTheme: row
				? {
						dark: row.publishedDark,
						light: row.publishedLight,
						presetId: row.publishedPresetId,
						version: PROJECT_THEME_VERSION,
					}
				: null,
			publishedTime: row?.publishedTime ?? null,
		};
	},
});

export const publish = mutation({
	args: {
		dark: paletteValidator,
		expectedPublishedRevision: v.number(),
		light: paletteValidator,
		presetId: presetValidator,
		projectId: v.id('projects'),
	},
	returns: v.object({
		publishedRevision: v.number(),
		publishedTheme: themeValidator,
		publishedTime: v.number(),
	}),
	handler: async (ctx, input) => {
		if (!Number.isSafeInteger(input.expectedPublishedRevision) || input.expectedPublishedRevision < 0)
			throw new ConvexError('INVALID_THEME_REVISION');
		const [{ user }, row] = await Promise.all([
			requireEditableProject(ctx, input.projectId),
			getThemeRow(ctx, input.projectId),
		]);
		const currentRevision = row?.publishedRevision ?? 0;
		if (currentRevision !== input.expectedPublishedRevision)
			throw new ConvexError('THEME_REVISION_CONFLICT');
		const theme = normalizeTheme(input);
		if (user.systemRole !== 'system:admin' && !isCuratedProjectTheme(theme))
			throw new ConvexError('CUSTOM_THEME_FORBIDDEN');
		const publishedRevision = currentRevision + 1;
		const publishedTime = Date.now();
		const values = {
			version: PROJECT_THEME_VERSION,
			publishedDark: theme.dark,
			publishedLight: theme.light,
			publishedPresetId: theme.presetId,
			publishedRevision,
			publishedTime,
			...(user.profileId ? { publishedByProfileId: user.profileId } : {}),
		};
		if (row) await ctx.db.patch('projectThemes', row._id, values);
		else await ctx.db.insert('projectThemes', { projectId: input.projectId, ...values });
		return { publishedRevision, publishedTheme: theme, publishedTime };
	},
});
