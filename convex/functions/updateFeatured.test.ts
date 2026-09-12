// @vitest-environment edge-runtime
import { describe, expect, it, vi } from 'vitest';

import { api, internal } from './_generated/api';
import {
	memberTable,
	organizationTable,
	profileTable,
	projectTable,
	sessionTable,
	updateTable,
	userTable,
} from './schema';
import { convexTest, runCtx } from './setup.testing';

type Ctx = Awaited<ReturnType<typeof runCtx>>;
type TestConvex = ReturnType<typeof convexTest>;

// listFeatured enriches items with emote/comment counts, which read the
// aggregate index. Fresh test tables report BUILDING until backfilled; run the
// backfill and drain its scheduled chunks so counts are readable.
async function backfillAggregates(t: TestConvex) {
	vi.useFakeTimers();
	try {
		await t.mutation(internal.generated.aggregate.aggregateBackfill, {});
		await t.finishAllScheduledFunctions(vi.runAllTimers);
	} finally {
		vi.useRealTimers();
	}
}

// Seed an authenticated org admin (user + profile + org + admin membership +
// session) with one public project — the minimum needed to exercise the update
// mutations' auth chain.
async function seedAdminWithProject(ctx: Ctx) {
	const [user] = await ctx.orm
		.insert(userTable)
		.values({
			createdAt: new Date(),
			email: 'featured-admin@example.com',
			emailVerified: true,
			name: 'Admin',
			updatedAt: new Date(),
		})
		.returning();
	const [profile] = await ctx.orm
		.insert(profileTable)
		.values({
			email: 'featured-admin@example.com',
			name: 'Admin',
			role: 'user',
			userId: user.id,
			username: 'featured_admin',
		})
		.returning();
	const [organization] = await ctx.orm
		.insert(organizationTable)
		.values({
			createdAt: new Date(),
			name: 'Acme',
			slug: 'acme-featured',
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
			token: 'featured-session-token',
			updatedAt: new Date(),
			userId: user.id,
		})
		.returning();
	const [project] = await ctx.orm
		.insert(projectTable)
		.values({
			name: 'Proj',
			orgSlug: organization.slug,
			slug: 'proj-featured',
			visibility: 'public',
		})
		.returning();
	return {
		profileId: profile.id,
		projectId: project.id,
		sessionId: session.id,
		userId: user.id,
	};
}

async function seedUpdate(
	ctx: Ctx,
	args: {
		authorProfileId: string;
		featuredAt?: number | null;
		projectId: string;
		publishedAt?: number | null;
		slug: string;
		status?: 'draft' | 'published';
		title: string;
	}
) {
	const [row] = await ctx.orm
		.insert(updateTable)
		.values({
			authorProfileId: args.authorProfileId as never,
			category: 'changelog',
			content: '<p>Body</p>',
			featuredAt: args.featuredAt ?? null,
			projectId: args.projectId as never,
			publishedAt: args.publishedAt ?? null,
			relatedFeedbackIds: [],
			slug: args.slug,
			status: args.status ?? 'published',
			tags: [],
			title: args.title,
			updatedTime: Date.now(),
		})
		.returning();
	return row;
}

describe('update featured flag', () => {
	it('stamps featuredAt on create, preserves it on re-save, clears it on uncheck', async () => {
		const t = convexTest();
		const seed = await t.run((baseCtx) => runCtx(baseCtx).then(seedAdminWithProject));
		const asAdmin = t.withIdentity({ sessionId: seed.sessionId, subject: seed.userId });

		const created = await asAdmin.mutation(api.update.create, {
			content: '<p>Hello</p>',
			featured: true,
			projectId: seed.projectId,
			title: 'Featured on create',
		});

		const readFeaturedAt = () =>
			t.run(async (baseCtx) => {
				const ctx = await runCtx(baseCtx);
				return (await ctx.orm.query.update.findFirst({ where: { id: created.updateId } }))
					?.featuredAt;
			});

		const stamped = await readFeaturedAt();
		expect(stamped).toBeTypeOf('number');

		// Re-saving with the checkbox still on must not bump the stamp (that
		// would reshuffle the hero on every save).
		await asAdmin.mutation(api.update.update, {
			featured: true,
			id: created.updateId,
			title: 'Renamed',
		});
		expect(await readFeaturedAt()).toBe(stamped);

		await asAdmin.mutation(api.update.update, {
			featured: false,
			id: created.updateId,
		});
		expect(await readFeaturedAt()).toBeNull();
	});
});

describe('update.listFeatured', () => {
	it('latest mode (default) returns the newest published updates, drafts excluded', async () => {
		const t = convexTest();
		const seed = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const admin = await seedAdminWithProject(ctx);
			const base = { authorProfileId: admin.profileId, projectId: admin.projectId };
			await seedUpdate(ctx, { ...base, publishedAt: 1000, slug: 'u-a', title: 'A' });
			await seedUpdate(ctx, { ...base, publishedAt: 2000, slug: 'u-b', title: 'B' });
			await seedUpdate(ctx, { ...base, publishedAt: 3000, slug: 'u-c', title: 'C' });
			await seedUpdate(ctx, { ...base, publishedAt: 4000, slug: 'u-d', title: 'D' });
			await seedUpdate(ctx, { ...base, slug: 'u-draft', status: 'draft', title: 'Draft' });
			return admin;
		});
		await backfillAggregates(t);

		const result = await t.query(api.update.listFeatured, { projectId: seed.projectId });

		expect(result.mode).toBe('latest');
		expect(result.isFallback).toBe(false);
		expect(result.items.map((item: { title: string }) => item.title)).toEqual(['D', 'C', 'B']);
	});

	it('manual mode returns published featured updates ordered by publish date', async () => {
		const t = convexTest();
		const seed = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const admin = await seedAdminWithProject(ctx);
			await ctx.db.patch('project', admin.projectId as never, {
				updatesFeaturedMode: 'manual',
			});
			const base = { authorProfileId: admin.profileId, projectId: admin.projectId };
			await seedUpdate(ctx, {
				...base,
				featuredAt: 1000,
				publishedAt: 1000,
				slug: 'f-a',
				title: 'A',
			});
			await seedUpdate(ctx, {
				...base,
				featuredAt: 2000,
				publishedAt: 500,
				slug: 'f-b',
				title: 'B',
			});
			// Featured but draft: must never appear in the section.
			await seedUpdate(ctx, {
				...base,
				featuredAt: 3000,
				slug: 'f-draft',
				status: 'draft',
				title: 'Draft',
			});
			await seedUpdate(ctx, { ...base, publishedAt: 9000, slug: 'f-plain', title: 'Plain' });
			return admin;
		});
		await backfillAggregates(t);

		const result = await t.query(api.update.listFeatured, { projectId: seed.projectId });

		expect(result.mode).toBe('manual');
		expect(result.isFallback).toBe(false);
		// B was featured most recently (featuredAt 2000) but published earliest
		// (publishedAt 500), so A leads the section.
		expect(result.items.map((item: { title: string }) => item.title)).toEqual(['A', 'B']);
	});

	it('manual mode falls back to the latest published updates when nothing is featured', async () => {
		const t = convexTest();
		const seed = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const admin = await seedAdminWithProject(ctx);
			await ctx.db.patch('project', admin.projectId as never, {
				updatesFeaturedMode: 'manual',
			});
			const base = { authorProfileId: admin.profileId, projectId: admin.projectId };
			await seedUpdate(ctx, { ...base, publishedAt: 1000, slug: 'fb-a', title: 'A' });
			await seedUpdate(ctx, { ...base, publishedAt: 2000, slug: 'fb-b', title: 'B' });
			return admin;
		});
		await backfillAggregates(t);

		const result = await t.query(api.update.listFeatured, { projectId: seed.projectId });

		expect(result.mode).toBe('manual');
		expect(result.isFallback).toBe(true);
		expect(result.items.map((item: { title: string }) => item.title)).toEqual(['B', 'A']);
	});
});

describe('update.searchProject (inline index search path)', () => {
	it('matches searchContent and respects the category filter', async () => {
		const t = convexTest();
		const seed = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const admin = await seedAdminWithProject(ctx);
			const base = { authorProfileId: admin.profileId, projectId: admin.projectId };
			const [row] = await ctx.orm
				.insert(updateTable)
				.values({
					authorProfileId: base.authorProfileId as never,
					category: 'announcement',
					content: '<p>Body</p>',
					projectId: base.projectId as never,
					publishedAt: 1000,
					relatedFeedbackIds: [],
					searchContent: 'Shiny release notes\nBody',
					slug: 's-a',
					status: 'published',
					tags: [],
					title: 'Shiny release notes',
					updatedTime: Date.now(),
				})
				.returning();
			return { ...admin, updateId: row.id };
		});
		await backfillAggregates(t);

		const hit = await t.query(api.update.searchProject, {
			cursor: null,
			limit: 10,
			projectId: seed.projectId,
			search: 'shiny',
		});
		expect(hit.page.map((item: { title: string }) => item.title)).toEqual(['Shiny release notes']);

		// Category-scoped search: same term, wrong category → no results.
		const miss = await t.query(api.update.searchProject, {
			category: 'changelog',
			cursor: null,
			limit: 10,
			projectId: seed.projectId,
			search: 'shiny',
		});
		expect(miss.page).toEqual([]);
	});
});

describe('project.update featured mode setting', () => {
	it('lets a project admin switch the featured mode', async () => {
		const t = convexTest();
		const seed = await t.run((baseCtx) => runCtx(baseCtx).then(seedAdminWithProject));
		const asAdmin = t.withIdentity({ sessionId: seed.sessionId, subject: seed.userId });

		await asAdmin.mutation(api.project.update, {
			id: seed.projectId,
			updatesFeaturedMode: 'manual',
		});

		const mode = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			return (await ctx.orm.query.project.findFirst({ where: { id: seed.projectId } }))
				?.updatesFeaturedMode;
		});
		expect(mode).toBe('manual');
	});
});
