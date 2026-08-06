// @vitest-environment edge-runtime
import { eq } from 'kitcn/orm';
import { describe, expect, it } from 'vitest';

import { createProjectThemeFromAccent, PROJECT_THEME_PRESETS } from '../shared/project-theme';
import { api } from './_generated/api';
import {
	memberTable,
	organizationTable,
	profileTable,
	projectTable,
	projectThemeTable,
	sessionTable,
	userTable,
} from './schema';
import { convexTest, runCtx } from './setup.testing';

async function seedProject(
	t: ReturnType<typeof convexTest>,
	role: 'system:admin' | 'user' = 'user'
) {
	return t.run(async (baseCtx) => {
		const ctx = await runCtx(baseCtx);
		const [user] = await ctx.orm
			.insert(userTable)
			.values({
				createdAt: new Date(),
				email: 'theme@example.com',
				emailVerified: true,
				name: 'Theme Editor',
				role,
				updatedAt: new Date(),
			})
			.returning();
		const [profile] = await ctx.orm
			.insert(profileTable)
			.values({
				email: user.email,
				name: user.name,
				role,
				userId: user.id,
				username: 'theme_editor',
			})
			.returning();
		const [organization] = await ctx.orm
			.insert(organizationTable)
			.values({
				createdAt: new Date(),
				name: 'Themes',
				slug: 'themes',
				visibility: 'public',
			})
			.returning();
		await ctx.orm.insert(memberTable).values({
			createdAt: new Date(),
			organizationId: organization.id,
			role: 'admin',
			userId: user.id,
		});
		const [session] = await ctx.orm
			.insert(sessionTable)
			.values({
				createdAt: new Date(),
				expiresAt: new Date(Date.now() + 86_400_000),
				token: 'theme-session',
				updatedAt: new Date(),
				userId: user.id,
			})
			.returning();
		const [project] = await ctx.orm
			.insert(projectTable)
			.values({
				name: 'Styled project',
				orgSlug: organization.slug,
				slug: 'styled',
				visibility: 'public',
			})
			.returning();
		return { profileId: profile.id, projectId: project.id, sessionId: session.id, userId: user.id };
	});
}

describe('project theme publishing', () => {
	it('publishes the complete theme atomically', async () => {
		const t = convexTest();
		const seed = await seedProject(t);
		const asEditor = t.withIdentity({ sessionId: seed.sessionId, subject: seed.userId });

		const before = await t.query(api.project.getDetails, { orgSlug: 'themes', slug: 'styled' });
		expect(before?.publishedTheme).toBeNull();

		const published = await asEditor.mutation(api.projectTheme.publish, {
			dark: PROJECT_THEME_PRESETS.golden.dark,
			expectedPublishedRevision: 0,
			light: PROJECT_THEME_PRESETS.golden.light,
			presetId: 'golden',
			projectId: seed.projectId,
		});
		const afterPublish = await t.query(api.project.getDetails, {
			orgSlug: 'themes',
			slug: 'styled',
		});
		expect(afterPublish?.publishedTheme).toMatchObject({ presetId: 'golden', version: 1 });
		expect(published.publishedRevision).toBe(1);
	});

	it('rejects stale writes and cascades theme deletion', async () => {
		const t = convexTest();
		const seed = await seedProject(t);
		const asEditor = t.withIdentity({ sessionId: seed.sessionId, subject: seed.userId });
		await asEditor.mutation(api.projectTheme.publish, {
			dark: PROJECT_THEME_PRESETS.kino.dark,
			expectedPublishedRevision: 0,
			light: PROJECT_THEME_PRESETS.kino.light,
			presetId: 'kino',
			projectId: seed.projectId,
		});
		await expect(
			asEditor.mutation(api.projectTheme.publish, {
				dark: PROJECT_THEME_PRESETS.forest.dark,
				expectedPublishedRevision: 0,
				light: PROJECT_THEME_PRESETS.forest.light,
				presetId: 'forest',
				projectId: seed.projectId,
			})
		).rejects.toThrow(/changed elsewhere/i);

		await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			await ctx.orm.delete(projectTable).where(eq(projectTable.id, seed.projectId));
		});
		const theme = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			return ctx.orm.query.projectTheme.findFirst({ where: { projectId: seed.projectId } });
		});
		expect(theme).toBeNull();
	});

	it('accepts legacy draft fields and clears them on publish', async () => {
		const t = convexTest();
		const seed = await seedProject(t);
		await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			await ctx.orm.insert(projectThemeTable).values({
				draftDark: PROJECT_THEME_PRESETS.sunset.dark,
				draftLight: PROJECT_THEME_PRESETS.sunset.light,
				draftRevision: 19,
				draftUpdatedTime: Date.now(),
				presetId: 'custom',
				projectId: seed.projectId,
				publishedByProfileId: seed.profileId,
				publishedDark: PROJECT_THEME_PRESETS.sunset.dark,
				publishedLight: PROJECT_THEME_PRESETS.sunset.light,
				publishedPresetId: 'custom',
				publishedRevision: 19,
				publishedTime: Date.now(),
				version: 1,
			});
		});

		const asEditor = t.withIdentity({ sessionId: seed.sessionId, subject: seed.userId });
		await asEditor.mutation(api.projectTheme.publish, {
			dark: PROJECT_THEME_PRESETS.forest.dark,
			expectedPublishedRevision: 19,
			light: PROJECT_THEME_PRESETS.forest.light,
			presetId: 'forest',
			projectId: seed.projectId,
		});

		const theme = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			return ctx.orm.query.projectTheme.findFirst({ where: { projectId: seed.projectId } });
		});
		expect(theme?.draftDark).toBeUndefined();
		expect(theme?.draftLight).toBeUndefined();
		expect(theme?.draftRevision).toBeUndefined();
		expect(theme?.draftUpdatedTime).toBeUndefined();
		expect(theme?.presetId).toBeUndefined();
		expect(theme?.publishedPresetId).toBe('forest');
	});

	it('restricts custom accents to Kino administrators', async () => {
		const customTheme = createProjectThemeFromAccent('#6d28d9', 'custom');
		expect(customTheme).not.toBeNull();
		if (!customTheme) return;

		const memberTest = convexTest();
		const member = await seedProject(memberTest);
		const asMember = memberTest.withIdentity({
			sessionId: member.sessionId,
			subject: member.userId,
		});
		const memberState = await asMember.query(api.projectTheme.getEditorState, {
			projectId: member.projectId,
		});
		expect(memberState.canUseCustomAccent).toBe(false);
		await expect(
			asMember.mutation(api.projectTheme.publish, {
				dark: customTheme.dark,
				expectedPublishedRevision: 0,
				light: customTheme.light,
				presetId: 'custom',
				projectId: member.projectId,
			})
		).rejects.toThrow(/administrator access/i);

		const adminTest = convexTest();
		const admin = await seedProject(adminTest, 'system:admin');
		const asAdmin = adminTest.withIdentity({
			sessionId: admin.sessionId,
			subject: admin.userId,
		});
		const adminState = await asAdmin.query(api.projectTheme.getEditorState, {
			projectId: admin.projectId,
		});
		expect(adminState.canUseCustomAccent).toBe(true);
		await expect(
			asAdmin.mutation(api.projectTheme.publish, {
				dark: customTheme.dark,
				expectedPublishedRevision: 0,
				light: customTheme.light,
				presetId: 'custom',
				projectId: admin.projectId,
			})
		).resolves.toMatchObject({ publishedRevision: 1 });
	});
});
