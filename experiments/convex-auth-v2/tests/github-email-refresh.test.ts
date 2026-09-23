// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { expect, test } from 'vitest';

import schema from '../email/convex/schema';

const modules = import.meta.glob('../email/convex/**/*.ts');
const refresh = makeFunctionReference<'mutation'>('github:onSignIn');
const provider = {
	name: 'github',
	accountId: '123',
	profile: { id: '123', login: 'proof', email: 'verified@example.test', emailVerified: true },
};
test('fresh provider evidence upgrades old Github email marker without linking password account', async () => {
	const t = convexTest(schema, modules);
	const userId = await t.run((ctx) =>
		ctx.db.insert('users', {
			githubId: '123',
			githubEmail: 'old@example.test',
			verified: true,
			verificationGeneration: 0,
			resetGeneration: 0,
		})
	);
	await t.mutation(refresh, { userId, provider });
	expect(await t.run((ctx) => ctx.db.get(userId))).toMatchObject({
		githubEmail: 'verified@example.test',
		githubEmailVerified: true,
	});
	expect((await t.run((ctx) => ctx.db.get(userId)))?.email).toBeUndefined();
});
test('unverified provider email and mismatched account cannot refresh verified address', async () => {
	const t = convexTest(schema, modules);
	const userId = await t.run((ctx) =>
		ctx.db.insert('users', {
			githubId: '123',
			githubEmail: 'old@example.test',
			verified: true,
			verificationGeneration: 0,
			resetGeneration: 0,
		})
	);
	for (const value of [
		{ ...provider, profile: { ...provider.profile, emailVerified: false } },
		{ ...provider, accountId: '456' },
		{ ...provider, profile: { ...provider.profile, id: '456' } },
	])
		await expect(t.mutation(refresh, { userId, provider: value })).rejects.toThrow();
	expect(await t.run((ctx) => ctx.db.get(userId))).toMatchObject({
		githubEmail: 'old@example.test',
	});
	expect((await t.run((ctx) => ctx.db.get(userId)))?.githubEmailVerified).toBeUndefined();
});
