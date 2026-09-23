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
		const owner = await ctx.db.insert('users', {
			githubEmail: 'github@example.test',
			githubEmailVerifiedAt: 1,
			passwordEmail: 'password@example.test',
			status: 'active',
			systemRole: 'user',
		});
		const other = await ctx.db.insert('users', {
			passwordEmail: 'other@example.test',
			passwordEmailVerifiedAt: 1,
			status: 'active',
			systemRole: 'user',
		});
		const ownerProfile = await ctx.db.insert('profiles', {
			name: 'Owner',
			userId: owner,
			username: 'owner',
		});
		const otherProfile = await ctx.db.insert('profiles', {
			name: 'Other',
			userId: other,
			username: 'other',
		});
		await ctx.db.patch('users', owner, { profileId: ownerProfile });
		await ctx.db.patch('users', other, { profileId: otherProfile });
		const publicOrg = await ctx.db.insert('organizations', {
			name: 'Public org',
			slug: 'public-org',
			visibility: 'public',
		});
		const privateOrg = await ctx.db.insert('organizations', {
			name: 'Private org',
			slug: 'private-org',
			visibility: 'private',
		});
		await ctx.db.insert('memberships', { organizationId: publicOrg, role: 'owner', userId: owner });
		await ctx.db.insert('memberships', {
			organizationId: privateOrg,
			role: 'moderator',
			userId: owner,
		});
		return { other, otherProfile, owner, ownerProfile, privateOrg, publicOrg };
	});
	return {
		ids,
		other: t.withIdentity({ issuer, subject: ids.other }),
		owner: t.withIdentity({ issuer, subject: ids.owner }),
		t,
	};
}

async function upload(
	t: Awaited<ReturnType<typeof fixture>>['t'],
	type: string,
	content = 'avatar'
) {
	return t.run(async (ctx) => {
		const storageId = await ctx.storage.store(new Blob([content], { type }));
		// convex-test omits Blob.type from its synthetic _storage row.
		// @ts-expect-error _storage is a system table and is absent from the application DataModel.
		await ctx.db.patch('_storage', storageId, { contentType: type });
		return storageId as Id<'_storage'>;
	});
}

test('returns only verified email evidence and updates the owned profile with unique usernames', async () => {
	const s = await fixture();
	expect(await s.owner.query(api.profiles.me, {})).toMatchObject({
		email: 'github@example.test',
		role: 'user',
		systemRole: 'user',
	});
	await s.t.run(async (ctx) => {
		await ctx.db.patch('users', s.ids.owner, { passwordEmailVerifiedAt: 2 });
	});
	expect(await s.owner.query(api.profiles.me, {})).toMatchObject({
		email: 'password@example.test',
	});
	await expect(
		s.owner.mutation(api.profiles.update, {
			profile: {},
			user: { name: 'Renamed', username: 'other' },
		})
	).rejects.toThrow('USERNAME_TAKEN');
	await expect(
		s.owner.mutation(api.profiles.update, {
			profile: {
				bio: 'Builder',
				location: 'Mexico City',
				urls: [{ text: 'Site', url: 'https://example.test' }],
			},
			user: { name: 'Renamed', username: 'renamed_owner' },
		})
	).resolves.toMatchObject({
		bio: 'Builder',
		location: 'Mexico City',
		name: 'Renamed',
		username: 'renamed_owner',
	});
});

test('public profiles hide private organizations from other viewers but reveal them to the owner', async () => {
	const s = await fixture();
	const publicView = await s.other.query(api.profiles.getByUsername, { username: 'owner' });
	expect(publicView).toMatchObject({
		isViewerProfile: false,
		memberOrganizations: [],
		ownedOrganizations: [{ id: s.ids.publicOrg, visibility: 'public' }],
	});
	const ownerView = await s.owner.query(api.profiles.getByUsername, { username: 'owner' });
	expect(ownerView).toMatchObject({
		isViewerProfile: true,
		memberOrganizations: [{ id: s.ids.privateOrg, visibility: 'private' }],
		ownedOrganizations: [{ id: s.ids.publicOrg, visibility: 'public' }],
	});
});

test('avatar intents are owner-bound, single-use, validated, and replace old storage', async () => {
	const s = await fixture();
	const invalidIntent = await s.owner.mutation(api.profiles.generateAvatarUploadUrl, {});
	const invalid = await upload(s.t, 'text/plain');
	await expect(
		s.owner.mutation(api.profiles.commitAvatar, {
			storageId: invalid,
			uploadToken: invalidIntent.uploadToken,
		})
	).rejects.toThrow('INVALID_AVATAR_TYPE');

	const firstIntent = await s.owner.mutation(api.profiles.generateAvatarUploadUrl, {});
	const first = await upload(s.t, 'image/png', 'first');
	await expect(
		s.other.mutation(api.profiles.commitAvatar, {
			storageId: first,
			uploadToken: firstIntent.uploadToken,
		})
	).rejects.toThrow('INVALID_AVATAR_UPLOAD_INTENT');
	await s.owner.mutation(api.profiles.commitAvatar, {
		storageId: first,
		uploadToken: firstIntent.uploadToken,
	});
	await expect(
		s.owner.mutation(api.profiles.commitAvatar, {
			storageId: first,
			uploadToken: firstIntent.uploadToken,
		})
	).rejects.toThrow('INVALID_AVATAR_UPLOAD_INTENT');

	const secondIntent = await s.owner.mutation(api.profiles.generateAvatarUploadUrl, {});
	const second = await upload(s.t, 'image/webp', 'second');
	await s.owner.mutation(api.profiles.commitAvatar, {
		storageId: second,
		uploadToken: secondIntent.uploadToken,
	});
	expect(await s.t.run((ctx) => ctx.db.system.get('_storage', first))).toBeNull();
	expect(await s.t.run((ctx) => ctx.db.system.get('_storage', second))).not.toBeNull();
});

test('registered abandoned avatars are deleted when their intents expire', async () => {
	const s = await fixture();
	const intent = await s.owner.mutation(api.profiles.generateAvatarUploadUrl, {});
	const storageId = await upload(s.t, 'image/png', 'abandoned');
	await expect(
		s.other.mutation(api.profiles.registerAvatarUpload, {
			storageId,
			uploadToken: intent.uploadToken,
		})
	).rejects.toThrow('INVALID_AVATAR_UPLOAD_INTENT');
	await s.owner.mutation(api.profiles.registerAvatarUpload, {
		storageId,
		uploadToken: intent.uploadToken,
	});
	await s.t.run(async (ctx) => {
		const row = await ctx.db
			.query('profileAvatarUploadIntents')
			.withIndex('by_token', (q) => q.eq('token', intent.uploadToken))
			.unique();
		await ctx.db.patch('profileAvatarUploadIntents', row!._id, { expiresAt: Date.now() - 1 });
	});
	expect(await s.t.mutation(internal.profiles.clearExpiredAvatarUploadIntents, {})).toBe(1);
	expect(await s.t.run((ctx) => ctx.db.system.get('_storage', storageId))).toBeNull();
});

test('discarding a registered avatar deletes its blob without touching the current avatar', async () => {
	const s = await fixture();
	const keptIntent = await s.owner.mutation(api.profiles.generateAvatarUploadUrl, {});
	const keptId = await upload(s.t, 'image/png', 'kept');
	await s.owner.mutation(api.profiles.commitAvatar, {
		storageId: keptId,
		uploadToken: keptIntent.uploadToken,
	});
	const pending = await s.owner.mutation(api.profiles.generateAvatarUploadUrl, {});
	const abandonedId = await upload(s.t, 'image/png', 'abandoned');
	await s.owner.mutation(api.profiles.registerAvatarUpload, {
		storageId: abandonedId,
		uploadToken: pending.uploadToken,
	});
	await expect(
		s.other.mutation(api.profiles.discardAvatarUpload, { uploadToken: pending.uploadToken })
	).rejects.toThrow('FORBIDDEN');
	expect(
		await s.owner.mutation(api.profiles.discardAvatarUpload, {
			uploadToken: pending.uploadToken,
		})
	).toBe(true);
	expect(await s.t.run((ctx) => ctx.db.system.get('_storage', abandonedId))).toBeNull();
	expect(await s.t.run((ctx) => ctx.db.system.get('_storage', keptId))).not.toBeNull();
});
