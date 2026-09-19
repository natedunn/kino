// @vitest-environment edge-runtime
import { afterEach, expect, test, vi } from 'vitest';

import { internal } from './_generated/api';
import { convexTest } from './setup.testing';

afterEach(() => vi.useRealTimers());

test('verification sweep preserves unexpired rows and drains bounded batches', async () => {
	vi.useFakeTimers();
	const now = Date.now();
	const t = convexTest();
	await t.run(async (ctx) => {
		for (let i = 0; i < 205; i++) {
			await ctx.db.insert('verification', {
				identifier: `expired-${i}`,
				value: 'temporary',
				expiresAt: now - 1,
				createdAt: now - 1000,
				updatedAt: now - 1000,
			});
		}
		for (const expiresAt of [now, now + 3600000]) {
			await ctx.db.insert('verification', {
				identifier: `valid-${expiresAt}`,
				value: 'temporary',
				expiresAt,
				createdAt: now - 1000,
				updatedAt: now - 1000,
			});
		}
	});
	await t.mutation(internal.crons.cleanupExpiredVerifications, {});
	expect(await t.run((ctx) => ctx.db.query('verification').collect())).toHaveLength(7);
	await t.finishAllScheduledFunctions(() => vi.runAllTimers());
	const remaining = await t.run((ctx) => ctx.db.query('verification').collect());
	expect(remaining.map((row) => row.expiresAt).sort()).toEqual([now, now + 3600000]);
	await t.mutation(internal.crons.cleanupExpiredVerifications, {});
	expect(await t.run((ctx) => ctx.db.query('verification').collect())).toHaveLength(2);
});
