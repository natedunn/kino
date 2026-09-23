// @vitest-environment edge-runtime
import { PROJECT_THEME_PRESETS } from '../shared/project-theme';
import { convexTest } from 'convex-test';
import { beforeEach, expect, test } from 'vitest';

import { configureTestAuth, issuer } from '../testing/setup.testing';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.testing.ts']);

beforeEach(configureTestAuth);

async function fixture() {
	const t = convexTest(schema, modules);
	const ids = await t.run(async (ctx) => {
		const owner = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const outsider = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const ownerProfile = await ctx.db.insert('profiles', {
			name: 'Owner',
			userId: owner,
			username: 'owner',
		});
		const outsiderProfile = await ctx.db.insert('profiles', {
			name: 'Outsider',
			userId: outsider,
			username: 'outsider',
		});
		await ctx.db.patch('users', owner, { profileId: ownerProfile });
		await ctx.db.patch('users', outsider, { profileId: outsiderProfile });
		const organizationId = await ctx.db.insert('organizations', {
			name: 'Acme',
			slug: 'acme',
			visibility: 'public',
		});
		await ctx.db.insert('memberships', { organizationId, role: 'owner', userId: owner });
		const projectId = await ctx.db.insert('projects', {
			name: 'Product',
			organizationId,
			slug: 'product',
			visibility: 'public',
		});
		return { outsider, owner, projectId };
	});
	return {
		ids,
		outsider: t.withIdentity({ issuer, subject: ids.outsider }),
		owner: t.withIdentity({ issuer, subject: ids.owner }),
		t,
	};
}

test('publishes curated themes with conflict protection and blocks non-managers and archives', async () => {
	const s = await fixture();
	await expect(
		s.t.query(api.projectAppearance.getEditorState, { projectId: s.ids.projectId })
	).rejects.toThrow(
		'UNAUTHORIZED'
	);
	await expect(
		s.outsider.query(api.projectAppearance.getEditorState, { projectId: s.ids.projectId })
	).rejects.toThrow('FORBIDDEN');

	const kino = PROJECT_THEME_PRESETS.kino;
	const published = await s.owner.mutation(api.projectAppearance.publish, {
		dark: kino.dark,
		expectedPublishedRevision: 0,
		light: kino.light,
		presetId: kino.presetId,
		projectId: s.ids.projectId,
	});
	expect(published).toMatchObject({ publishedRevision: 1, publishedTheme: kino });
	await expect(
		s.owner.mutation(api.projectAppearance.publish, {
			dark: kino.dark,
			expectedPublishedRevision: 0,
			light: kino.light,
			presetId: kino.presetId,
			projectId: s.ids.projectId,
		})
	).rejects.toThrow('THEME_REVISION_CONFLICT');

	await s.t.run((ctx) => ctx.db.patch('projects', s.ids.projectId, { visibility: 'archived' }));
	await expect(
		s.owner.mutation(api.projectAppearance.publish, {
			dark: kino.dark,
			expectedPublishedRevision: 1,
			light: kino.light,
			presetId: kino.presetId,
			projectId: s.ids.projectId,
		})
	).rejects.toThrow('PROJECT_ARCHIVED');
});
