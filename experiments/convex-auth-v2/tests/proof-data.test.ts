// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { expect, test } from 'vitest';

import schema from '../email/convex/schema';

const modules = import.meta.glob('../email/convex/**/*.ts');
const read = makeFunctionReference<'query'>('proof:read');
const increment = makeFunctionReference<'mutation'>('proof:increment');
const setup = () => convexTest(schema, modules);
async function user(t: ReturnType<typeof setup>, email: string, verified = true) {
	const id = await t.run((ctx) =>
		ctx.db.insert('users', { email, verified, verificationGeneration: 0, resetGeneration: 0 })
	);
	return t.withIdentity({ subject: id });
}
test('private proof query and mutation reject anonymous and unverified identities', async () => {
	const t = setup();
	const unverified = await user(t, 'unverified@example.test', false);
	for (const client of [t, unverified]) {
		await expect(client.query(read, { slug: 'alpha' })).rejects.toThrow('UNAUTHORIZED');
		await expect(client.mutation(increment, { slug: 'alpha' })).rejects.toThrow('UNAUTHORIZED');
	}
});
test('private counters isolate two verified users and route arguments', async () => {
	const t = setup();
	const alice = await user(t, 'alice@example.test');
	const bob = await user(t, 'bob@example.test');
	await alice.mutation(increment, { slug: 'alpha' });
	expect((await alice.query(read, { slug: 'alpha' })).value).toBe(1);
	expect((await alice.query(read, { slug: 'beta' })).value).toBe(0);
	expect((await bob.query(read, { slug: 'alpha' })).value).toBe(0);
	await bob.mutation(increment, { slug: 'alpha' });
	await bob.mutation(increment, { slug: 'alpha' });
	expect((await bob.query(read, { slug: 'alpha' })).value).toBe(2);
	expect((await alice.query(read, { slug: 'alpha' })).value).toBe(1);
});
test('caller cannot override ownership using a userId argument', async () => {
	const t = setup();
	const alice = await user(t, 'alice@example.test');
	await expect(alice.query(read, { slug: 'alpha', userId: 'someone-else' })).rejects.toThrow();
	await expect(
		alice.mutation(increment, { slug: 'alpha', userId: 'someone-else' })
	).rejects.toThrow();
});
