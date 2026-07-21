// @vitest-environment edge-runtime
import { eq } from 'kitcn/orm';
import { describe, expect, it, vi } from 'vitest';

import { internal } from './_generated/api';
import {
	profileTable,
	projectTable,
	updateCommentTable,
	updateEmoteTable,
	updateTable,
	userTable,
} from './schema';
import { convexTest, runCtx } from './setup.testing';

type Ctx = Awaited<ReturnType<typeof runCtx>>;
type TestConvex = ReturnType<typeof convexTest>;

// These tests guard the one silent failure mode of kitcn's aggregateIndex: the
// count kept in the hidden `aggregate_bucket` row drifting away from reality.
// They compare the fast aggregate count (ctx.orm.query.*.count — what the app
// uses for the update "heart" like count) against a raw ctx.db recount of the
// actual rows. If kitcn's change-trigger ever stops maintaining the bucket
// correctly, these break. See docs/reactions-aggregate.md.

async function seedAuthor(ctx: Ctx) {
	const [user] = await ctx.orm
		.insert(userTable)
		.values({
			createdAt: new Date(),
			email: 'author@example.com',
			emailVerified: true,
			name: 'Author',
			updatedAt: new Date(),
		})
		.returning();
	const [profile] = await ctx.orm
		.insert(profileTable)
		.values({
			email: 'author@example.com',
			name: 'Author',
			role: 'user',
			userId: user.id,
			username: 'author',
		})
		.returning();
	return { profile };
}

async function seedUpdate(ctx: Ctx, profileId: string) {
	const [project] = await ctx.orm
		.insert(projectTable)
		.values({
			name: 'Acme',
			orgSlug: 'acme',
			slug: 'acme',
			visibility: 'public',
		})
		.returning();
	const [update] = await ctx.orm
		.insert(updateTable)
		.values({
			authorProfileId: profileId,
			category: 'changelog',
			content: 'Body',
			projectId: project.id,
			slug: 'update-1',
			status: 'published',
			title: 'Update 1',
			updatedTime: Date.now(),
		})
		.returning();
	return { update };
}

// A filtered aggregate count only reads once its index is READY. Freshly created
// tables report BUILDING until backfilled, exactly as in production after a new
// aggregateIndex is deployed. Kick off the backfill and drain the scheduled
// chunk mutations so the index is READY before we assert.
async function backfillAggregates(t: TestConvex) {
	vi.useFakeTimers();
	try {
		await t.mutation(internal.generated.server.aggregateBackfill, {});
		await t.finishAllScheduledFunctions(vi.runAllTimers);
	} finally {
		vi.useRealTimers();
	}
}

// Ground-truth count by collecting the actual rows via ctx.db, independent of
// the aggregate bucket the code under test relies on.
async function rawEmoteCount(ctx: Ctx, updateId: string, content: string) {
	const rows = await ctx.db
		.query('updateEmote')
		.withIndex('by_updateId', (q: any) => q.eq('updateId', updateId))
		.collect();
	return rows.filter((r) => r.content === content).length;
}

async function rawCommentCount(ctx: Ctx, updateId: string) {
	const rows = await ctx.db
		.query('updateComment')
		.withIndex('by_updateId', (q: any) => q.eq('updateId', updateId))
		.collect();
	return rows.length;
}

describe('aggregateIndex count stays in sync with the rows (no drift)', () => {
	it('updateEmote heart count matches a raw recount across inserts and deletes', async () => {
		const t = convexTest();

		let updateId = '';
		let profileId = '';
		await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const { profile } = await seedAuthor(ctx);
			const { update } = await seedUpdate(ctx, profile.id);
			profileId = profile.id;
			updateId = update.id;
		});

		await backfillAggregates(t);

		await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const agg = () =>
				ctx.orm.query.updateEmote.count({
					where: { content: 'heart', updateId: updateId as never },
				});

			// Empty bucket reads as 0 and matches the raw recount.
			expect(await agg()).toBe(0);
			expect(await agg()).toBe(await rawEmoteCount(ctx, updateId, 'heart'));

			// Insert three hearts; the aggregate must track each one.
			const ids: string[] = [];
			for (let i = 0; i < 3; i++) {
				const [row] = await ctx.orm
					.insert(updateEmoteTable)
					.values({
						authorProfileId: profileId,
						content: 'heart',
						updateId,
					})
					.returning();
				ids.push(row.id);
			}
			expect(await agg()).toBe(3);
			expect(await agg()).toBe(await rawEmoteCount(ctx, updateId, 'heart'));

			// A different emote content must not leak into the heart bucket.
			await ctx.orm.insert(updateEmoteTable).values({
				authorProfileId: profileId,
				content: 'tada',
				updateId,
			});
			expect(await agg()).toBe(3);
			expect(await agg()).toBe(await rawEmoteCount(ctx, updateId, 'heart'));

			// Remove two hearts; the count decrements and still matches the rows.
			await ctx.orm.delete(updateEmoteTable).where(eq(updateEmoteTable.id, ids[0] as never));
			await ctx.orm.delete(updateEmoteTable).where(eq(updateEmoteTable.id, ids[1] as never));
			expect(await agg()).toBe(1);
			expect(await agg()).toBe(await rawEmoteCount(ctx, updateId, 'heart'));

			// Remove the last heart; the bucket returns to 0.
			await ctx.orm.delete(updateEmoteTable).where(eq(updateEmoteTable.id, ids[2] as never));
			expect(await agg()).toBe(0);
			expect(await agg()).toBe(await rawEmoteCount(ctx, updateId, 'heart'));
		});
	});

	it('updateComment count matches a raw recount across inserts and deletes', async () => {
		const t = convexTest();

		let updateId = '';
		let profileId = '';
		await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const { profile } = await seedAuthor(ctx);
			const { update } = await seedUpdate(ctx, profile.id);
			profileId = profile.id;
			updateId = update.id;
		});

		await backfillAggregates(t);

		await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const agg = () =>
				ctx.orm.query.updateComment.count({
					where: { updateId: updateId as never },
				});

			expect(await agg()).toBe(0);

			const ids: string[] = [];
			for (let i = 0; i < 4; i++) {
				const [row] = await ctx.orm
					.insert(updateCommentTable)
					.values({
						authorProfileId: profileId,
						content: `Comment ${i}`,
						updateId,
					})
					.returning();
				ids.push(row.id);
			}
			expect(await agg()).toBe(4);
			expect(await agg()).toBe(await rawCommentCount(ctx, updateId));

			await ctx.orm.delete(updateCommentTable).where(eq(updateCommentTable.id, ids[0] as never));
			expect(await agg()).toBe(3);
			expect(await agg()).toBe(await rawCommentCount(ctx, updateId));
		});
	});
});
