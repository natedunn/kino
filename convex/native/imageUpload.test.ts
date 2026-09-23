// @vitest-environment edge-runtime
import type { Id } from './_generated/dataModel';

import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';

import { internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.testing.ts']);

afterEach(() => vi.useRealTimers());

test('reclaims crashed uploads of any type while preserving referenced, pending, and recent files', async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-09-22T00:00:00.000Z'));
	const t = convexTest(schema, modules);
	const ids = await t.run(async (ctx) => {
		const userId = await ctx.db.insert('users', { status: 'active', systemRole: 'user' });
		const profileId = await ctx.db.insert('profiles', {
			name: 'Owner',
			username: 'owner',
			userId,
		});
		const attached = await ctx.storage.store(new Blob(['attached']));
		const pending = await ctx.storage.store(new Blob(['pending']));
		const orphan = await ctx.storage.store(new Blob(['orphan']));
		const otherType = await ctx.storage.store(new Blob(['other']));
		for (const id of [attached, pending, orphan]) {
			// convex-test does not retain Blob.type in synthetic metadata.
			// @ts-expect-error _storage is a system table outside the application schema.
			await ctx.db.patch('_storage', id, { contentType: 'image/png' });
		}
		// @ts-expect-error _storage is a system table outside the application schema.
		await ctx.db.patch('_storage', otherType, { contentType: 'text/plain' });
		await ctx.db.patch('profiles', profileId, { avatarStorageId: attached });
		await ctx.db.insert('profileAvatarUploadIntents', {
			createdAt: Date.now(),
			expiresAt: Date.now() + 60_000,
			profileId,
			requestedByUserId: userId,
			storageId: pending,
			token: 'pending',
		});
		return { attached, orphan, otherType, pending };
	});
	vi.setSystemTime(new Date('2026-09-23T02:00:00.000Z'));
	const recent = await t.run(async (ctx) => {
		const id = await ctx.storage.store(new Blob(['recent']));
		// @ts-expect-error _storage is a system table outside the application schema.
		await ctx.db.patch('_storage', id, { contentType: 'image/png' });
		return id;
	});
	const result = await t.mutation(internal.imageUpload.reconcileOrphanedImages, {});
	expect(result).toMatchObject({ deleted: 2, done: true });
	expect(await t.mutation(internal.imageUpload.reconcileOrphanedImages, {})).toEqual({
		checked: 0,
		deleted: 0,
		done: true,
	});
	await t.run(async (ctx) => {
		expect(await ctx.db.system.get('_storage', ids.orphan as Id<'_storage'>)).toBeNull();
		expect(await ctx.db.system.get('_storage', ids.otherType as Id<'_storage'>)).toBeNull();
		for (const id of [ids.attached, ids.pending, recent]) {
			expect(await ctx.db.system.get('_storage', id as Id<'_storage'>)).not.toBeNull();
		}
	});
});

test('continues through bounded pages after deleting a file in the first page', async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-09-22T00:00:00.000Z'));
	const t = convexTest(schema, modules);
	const ids = await t.run(async (ctx) => {
		const first = await ctx.storage.store(new Blob(['first']));
		// @ts-expect-error _storage is a system table outside the application schema.
		await ctx.db.patch('_storage', first, { contentType: 'image/png' });
		for (let i = 0; i < 21; i++) {
			const id = await ctx.storage.store(new Blob([`other-${i}`]));
			// @ts-expect-error _storage is a system table outside the application schema.
			await ctx.db.patch('_storage', id, { contentType: 'text/plain' });
		}
		const last = await ctx.storage.store(new Blob(['last']));
		// @ts-expect-error _storage is a system table outside the application schema.
		await ctx.db.patch('_storage', last, { contentType: 'image/png' });
		return { first, last };
	});
	vi.setSystemTime(new Date('2026-09-23T02:00:00.000Z'));
	const firstPage = await t.mutation(internal.imageUpload.reconcileOrphanedImages, {});
	expect(firstPage).toMatchObject({ checked: 20, deleted: 20, done: false });
	await t.finishAllScheduledFunctions(vi.runAllTimers);
	await t.run(async (ctx) => {
		expect(await ctx.db.system.get('_storage', ids.first as Id<'_storage'>)).toBeNull();
		expect(await ctx.db.system.get('_storage', ids.last as Id<'_storage'>)).toBeNull();
	});
});
