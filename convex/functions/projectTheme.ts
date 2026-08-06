import type { ProjectThemeInput, ProjectThemePalette } from '../shared/project-theme';

import { eq, unsetToken } from 'kitcn/orm';
import { CRPCError } from 'kitcn/server';
import { z } from 'zod';

import { authMutation, authQuery } from '../lib/crpc';
import { asId, verifyProjectAccess } from '../lib/kino';
import { idSchema } from '../lib/validation';
import {
	isCuratedProjectTheme,
	normalizeProjectThemePalette,
	normalizeProjectThemePresetId,
	PROJECT_THEME_PRESET_IDS,
	PROJECT_THEME_VERSION,
	validateProjectTheme,
} from '../shared/project-theme';
import { projectThemeTable } from './schema';

const colorSchema = z
	.string()
	.trim()
	.regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i);
const paletteSchema = z
	.object({
		background: colorSchema,
		foreground: colorSchema,
		primary: colorSchema,
		primaryForeground: colorSchema,
		surface: colorSchema,
		surfaceForeground: colorSchema,
	})
	.strict();
const presetSchema = z.enum(PROJECT_THEME_PRESET_IDS);

async function requireEditableProject(ctx: any, projectId: string) {
	const access = await verifyProjectAccess(ctx, { id: projectId, userId: ctx.userId });
	if (!access.project) throw new CRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
	if (!access.permissions.canEditSettings) {
		throw new CRPCError({ code: 'FORBIDDEN', message: 'User does not have permission' });
	}
	if (access.project.visibility === 'archived') {
		throw new CRPCError({ code: 'FORBIDDEN', message: 'Archived projects are read-only' });
	}
	return access;
}

function getThemeRow(ctx: any, projectId: string) {
	return ctx.db
		.query('projectTheme')
		.withIndex('by_projectId', (q: any) => q.eq('projectId', asId<'project'>(projectId)))
		.unique();
}

function normalizeTheme(input: {
	dark: ProjectThemePalette;
	light: ProjectThemePalette;
	presetId: (typeof PROJECT_THEME_PRESET_IDS)[number];
}): ProjectThemeInput {
	const dark = normalizeProjectThemePalette(input.dark);
	const light = normalizeProjectThemePalette(input.light);
	if (!dark || !light) {
		throw new CRPCError({ code: 'BAD_REQUEST', message: 'Invalid theme color' });
	}
	const theme: ProjectThemeInput = {
		dark,
		light,
		presetId: input.presetId,
		version: PROJECT_THEME_VERSION,
	};
	const issues = validateProjectTheme(theme);
	if (issues.length) {
		throw new CRPCError({
			code: 'BAD_REQUEST',
			message: `Theme does not meet contrast requirements: ${issues.map((issue) => `${issue.mode} ${issue.label}`).join(', ')}`,
		});
	}
	return theme;
}

export const getEditorState = authQuery
	.input(z.object({ projectId: idSchema }).strict())
	.query(async ({ ctx, input }) => {
		const access = await requireEditableProject(ctx, input.projectId);
		const row = await getThemeRow(ctx, input.projectId);
		const publishedTheme =
			row?.publishedLight && row.publishedDark
				? {
						dark: row.publishedDark,
						light: row.publishedLight,
						presetId: normalizeProjectThemePresetId(row.publishedPresetId ?? 'kino'),
						version: PROJECT_THEME_VERSION,
					}
				: null;
		return {
			canUseCustomAccent: access.profile.role === 'system:admin',
			publishedRevision: row?.publishedRevision ?? 0,
			publishedTheme,
			publishedTime: row?.publishedTime ?? null,
		};
	});

export const publish = authMutation
	.input(
		z
			.object({
				dark: paletteSchema,
				expectedPublishedRevision: z.number().int().nonnegative(),
				light: paletteSchema,
				presetId: presetSchema,
				projectId: idSchema,
			})
			.strict()
	)
	.mutation(async ({ ctx, input }) => {
		const access = await requireEditableProject(ctx, input.projectId);
		const row = await getThemeRow(ctx, input.projectId);
		const currentRevision = row?.publishedRevision ?? 0;
		if (currentRevision !== input.expectedPublishedRevision) {
			throw new CRPCError({ code: 'CONFLICT', message: 'Published theme changed elsewhere' });
		}
		const theme = normalizeTheme(input);
		if (access.profile.role !== 'system:admin' && !isCuratedProjectTheme(theme)) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'Custom accent colors require Kino administrator access',
			});
		}
		const publishedRevision = currentRevision + 1;
		const publishedTime = Date.now();
		const values = {
			publishedByProfileId: access.profile.id,
			publishedDark: theme.dark,
			publishedLight: theme.light,
			publishedPresetId: theme.presetId,
			publishedRevision,
			publishedTime,
			version: PROJECT_THEME_VERSION,
		};
		if (!row) {
			await ctx.orm.insert(projectThemeTable).values({
				...values,
				projectId: asId<'project'>(input.projectId),
			});
		} else {
			await ctx.orm
				.update(projectThemeTable)
				.set({
					...values,
					draftDark: unsetToken,
					draftLight: unsetToken,
					draftRevision: unsetToken,
					draftUpdatedTime: unsetToken,
					presetId: unsetToken,
				})
				.where(eq(projectThemeTable.id, row._id));
		}
		return { publishedRevision, publishedTheme: theme, publishedTime };
	});
