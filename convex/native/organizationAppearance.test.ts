// @vitest-environment edge-runtime
import type { Id } from './_generated/dataModel';

import { convexTest } from 'convex-test';
import { beforeEach, expect, test } from 'vitest';

import { configureTestAuth, issuer } from '../testing/setup.testing';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.testing.ts']);

beforeEach(configureTestAuth);

async function fixture() {
	const t = convexTest(schema, modules);
	const ids = await t.run(async (ctx) => {
		const owner = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const outsider = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const first = await ctx.db.insert('organizations', {
			name: 'First',
			slug: 'first',
			visibility: 'public',
		});
		const second = await ctx.db.insert('organizations', {
			name: 'Second',
			slug: 'second',
			visibility: 'public',
		});
		await ctx.db.insert('memberships', { organizationId: first, role: 'owner', userId: owner });
		await ctx.db.insert('memberships', { organizationId: second, role: 'owner', userId: owner });
		return { first, outsider, owner, second };
	});
	return {
		ids,
		outsider: t.withIdentity({ issuer, subject: ids.outsider }),
		owner: t.withIdentity({ issuer, subject: ids.owner }),
		t,
	};
}

async function upload(
	t: Awaited<ReturnType<typeof fixture>>['t'],
	type: string,
	content = 'image'
) {
	return t.run(async (ctx) => {
		const storageId = await ctx.storage.store(new Blob([content], { type }));
		// convex-test currently omits Blob.type from its synthetic _storage row.
		// Patch only that test metadata so the production validation path is exercised.
		// @ts-expect-error _storage is a system table and is intentionally absent from the app DataModel.
		await ctx.db.patch('_storage', storageId, { contentType: type });
		return storageId as Id<'_storage'>;
	});
}

test('requires a manager and validates uploaded logo metadata', async () => {
	const s = await fixture();
	await expect(
		s.outsider.mutation(api.organizationAppearance.generateLogoUploadUrl, {
			organizationId: s.ids.first,
		})
	).rejects.toThrow('FORBIDDEN');
	const intent = await s.owner.mutation(api.organizationAppearance.generateLogoUploadUrl, {
		organizationId: s.ids.first,
	});
	const invalid = await upload(s.t, 'text/plain');
	await expect(
		s.owner.mutation(api.organizationAppearance.commitLogo, {
			organizationId: s.ids.first,
			storageId: invalid,
			uploadToken: intent.uploadToken,
		})
	).rejects.toThrow('INVALID_LOGO_TYPE');
});

test('consumes upload intents, rejects replay and prevents cross-organization reuse', async () => {
	const s = await fixture();
	const firstIntent = await s.owner.mutation(api.organizationAppearance.generateLogoUploadUrl, {
		organizationId: s.ids.first,
	});
	const storageId = await upload(s.t, 'image/png');
	await expect(
		s.owner.mutation(api.organizationAppearance.commitLogo, {
			organizationId: s.ids.first,
			storageId,
			uploadToken: firstIntent.uploadToken,
		})
	).resolves.toMatchObject({ logo: expect.any(String) });
	await expect(
		s.owner.mutation(api.organizationAppearance.commitLogo, {
			organizationId: s.ids.first,
			storageId,
			uploadToken: firstIntent.uploadToken,
		})
	).rejects.toThrow('INVALID_LOGO_UPLOAD_INTENT');

	const secondIntent = await s.owner.mutation(api.organizationAppearance.generateLogoUploadUrl, {
		organizationId: s.ids.second,
	});
	await expect(
		s.owner.mutation(api.organizationAppearance.commitLogo, {
			organizationId: s.ids.second,
			storageId,
			uploadToken: secondIntent.uploadToken,
		})
	).rejects.toThrow();
});

test('deletes the previous logo only after a valid replacement is committed', async () => {
	const s = await fixture();
	const firstIntent = await s.owner.mutation(api.organizationAppearance.generateLogoUploadUrl, {
		organizationId: s.ids.first,
	});
	const firstStorageId = await upload(s.t, 'image/png', 'first');
	await s.owner.mutation(api.organizationAppearance.commitLogo, {
		organizationId: s.ids.first,
		storageId: firstStorageId,
		uploadToken: firstIntent.uploadToken,
	});
	const secondIntent = await s.owner.mutation(api.organizationAppearance.generateLogoUploadUrl, {
		organizationId: s.ids.first,
	});
	const secondStorageId = await upload(s.t, 'image/webp', 'second');
	await s.owner.mutation(api.organizationAppearance.commitLogo, {
		organizationId: s.ids.first,
		storageId: secondStorageId,
		uploadToken: secondIntent.uploadToken,
	});
	expect(await s.t.run((ctx) => ctx.db.system.get('_storage', firstStorageId))).toBeNull();
	expect(await s.t.run((ctx) => ctx.db.system.get('_storage', secondStorageId))).not.toBeNull();
});

test('registered abandoned logos are deleted on expiry without deleting committed logos', async () => {
	const s = await fixture();
	const pending = await s.owner.mutation(api.organizationAppearance.generateLogoUploadUrl, {
		organizationId: s.ids.first,
	});
	const abandonedId = await upload(s.t, 'image/png', 'abandoned');
	await s.owner.mutation(api.organizationAppearance.registerLogoUpload, {
		organizationId: s.ids.first,
		storageId: abandonedId,
		uploadToken: pending.uploadToken,
	});
	const kept = await s.owner.mutation(api.organizationAppearance.generateLogoUploadUrl, {
		organizationId: s.ids.first,
	});
	const keptId = await upload(s.t, 'image/webp', 'kept');
	await s.owner.mutation(api.organizationAppearance.registerLogoUpload, {
		organizationId: s.ids.first,
		storageId: keptId,
		uploadToken: kept.uploadToken,
	});
	await s.owner.mutation(api.organizationAppearance.commitLogo, {
		organizationId: s.ids.first,
		storageId: keptId,
		uploadToken: kept.uploadToken,
	});
	await s.t.run(async (ctx) => {
		const row = await ctx.db
			.query('organizationLogoUploadIntents')
			.withIndex('by_token', (q) => q.eq('token', pending.uploadToken))
			.unique();
		await ctx.db.patch('organizationLogoUploadIntents', row!._id, { expiresAt: Date.now() - 1 });
	});
	expect(
		await s.t.mutation(internal.organizationAppearance.clearExpiredLogoUploadIntents, {})
	).toBe(1);
	expect(await s.t.run((ctx) => ctx.db.system.get('_storage', abandonedId))).toBeNull();
	expect(await s.t.run((ctx) => ctx.db.system.get('_storage', keptId))).not.toBeNull();
});

test('discarding a registered logo removes its blob and cannot be called by an outsider', async () => {
	const s = await fixture();
	const intent = await s.owner.mutation(api.organizationAppearance.generateLogoUploadUrl, {
		organizationId: s.ids.first,
	});
	const storageId = await upload(s.t, 'image/png', 'discard');
	await s.owner.mutation(api.organizationAppearance.registerLogoUpload, {
		organizationId: s.ids.first,
		storageId,
		uploadToken: intent.uploadToken,
	});
	await expect(
		s.outsider.mutation(api.organizationAppearance.discardLogoUpload, {
			organizationId: s.ids.first,
			uploadToken: intent.uploadToken,
		})
	).rejects.toThrow('FORBIDDEN');
	expect(
		await s.owner.mutation(api.organizationAppearance.discardLogoUpload, {
			organizationId: s.ids.first,
			uploadToken: intent.uploadToken,
		})
	).toBe(true);
	expect(await s.t.run((ctx) => ctx.db.system.get('_storage', storageId))).toBeNull();
});
