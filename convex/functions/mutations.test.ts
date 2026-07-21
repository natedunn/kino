// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest';

import { api } from './_generated/api';
import {
	feedbackEventTable,
	feedbackTable,
	memberTable,
	organizationTable,
	profileTable,
	projectTable,
	sessionTable,
	userTable,
} from './schema';
import { convexTest, runCtx } from './setup.testing';

type Ctx = Awaited<ReturnType<typeof runCtx>>;

// Seed a full authenticated org-admin: user + profile + org + admin membership +
// a session row (so the kitcn auth chain — getHeaders → session.token → Bearer →
// auth.api.getSession — resolves), then a project (its insert trigger derives the
// org:admin projectMember granting canEdit) and a feedback row.
async function seedAuthedOrgAdmin(ctx: Ctx) {
	const [user] = await ctx.orm
		.insert(userTable)
		.values({
			createdAt: new Date(),
			email: 'admin@example.com',
			emailVerified: true,
			name: 'Admin',
			updatedAt: new Date(),
		})
		.returning();
	const [profile] = await ctx.orm
		.insert(profileTable)
		.values({
			email: 'admin@example.com',
			name: 'Admin',
			role: 'user',
			userId: user.id,
			username: 'admin_user',
		})
		.returning();
	const [organization] = await ctx.orm
		.insert(organizationTable)
		.values({
			createdAt: new Date(),
			name: 'Acme',
			slug: 'acme',
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
			token: 'test-session-token',
			updatedAt: new Date(),
			userId: user.id,
		})
		.returning();
	const [project] = await ctx.orm
		.insert(projectTable)
		.values({
			name: 'Proj',
			orgSlug: organization.slug,
			slug: 'proj',
			visibility: 'public',
		})
		.returning();
	const boards = await ctx.orm.query.feedbackBoard.findMany({
		where: { projectId: project.id },
		limit: 10,
	});
	const [feedback] = await ctx.orm
		.insert(feedbackTable)
		.values({
			authorProfileId: profile.id,
			boardId: boards[0].id,
			projectId: project.id,
			slug: 'feedback-1',
			status: 'open',
			title: 'Feedback 1',
			upvotes: 0,
		})
		.returning();
	return {
		feedbackId: feedback.id,
		profileId: profile.id,
		projectId: project.id,
		sessionId: session.id,
		userId: user.id,
	};
}

describe('feedback remove (authenticated end-to-end)', () => {
	it('permanently deletes the feedback', async () => {
		const t = convexTest();
		const seed = await t.run((baseCtx) => runCtx(baseCtx).then(seedAuthedOrgAdmin));
		const asUser = t.withIdentity({
			sessionId: seed.sessionId,
			subject: seed.userId,
		});

		await asUser.mutation(api.feedback.remove, { id: seed.feedbackId });

		const row = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			return ctx.orm.query.feedback.findFirst({
				where: { id: seed.feedbackId },
			});
		});
		// Hard delete — the row is gone, not soft-hidden.
		expect(row ?? null).toBeNull();
	});

	it('rejects an unauthenticated remove', async () => {
		const t = convexTest();
		const seed = await t.run((baseCtx) => runCtx(baseCtx).then(seedAuthedOrgAdmin));
		await expect(t.mutation(api.feedback.remove, { id: seed.feedbackId })).rejects.toThrow(
			/UNAUTHORIZED|authenticated/i
		);
	});
});

describe('feedback updatePriority (authenticated end-to-end)', () => {
	it('persists the priority and records a priority_changed event', async () => {
		const t = convexTest();
		const seed = await t.run((baseCtx) => runCtx(baseCtx).then(seedAuthedOrgAdmin));
		const asUser = t.withIdentity({
			sessionId: seed.sessionId,
			subject: seed.userId,
		});

		await asUser.mutation(api.feedback.updatePriority, {
			id: seed.feedbackId,
			priority: 'high',
		});

		const { row, events } = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const row = await ctx.orm.query.feedback.findFirst({
				where: { id: seed.feedbackId },
			});
			const events = await ctx.orm.query.feedbackEvent.findMany({
				where: { feedbackId: seed.feedbackId },
				limit: 10,
			});
			return { events, row };
		});

		expect(row?.priority).toBe('high');
		const priorityEvents = events.filter((e) => e.eventType === 'priority_changed');
		expect(priorityEvents).toHaveLength(1);
		expect(priorityEvents[0].metadata).toMatchObject({ newValue: 'high', oldValue: 'none' });
	});

	it('coalesces rapid same-actor priority changes into one timeline event', async () => {
		const t = convexTest();
		const seed = await t.run((baseCtx) => runCtx(baseCtx).then(seedAuthedOrgAdmin));
		const asUser = t.withIdentity({
			sessionId: seed.sessionId,
			subject: seed.userId,
		});

		await asUser.mutation(api.feedback.updatePriority, {
			id: seed.feedbackId,
			priority: 'low',
		});
		await asUser.mutation(api.feedback.updatePriority, {
			id: seed.feedbackId,
			priority: 'urgent',
		});

		const { row, priorityEvents } = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const row = await ctx.orm.query.feedback.findFirst({
				where: { id: seed.feedbackId },
			});
			const events = await ctx.orm.query.feedbackEvent.findMany({
				where: { feedbackId: seed.feedbackId },
				limit: 10,
			});
			return { priorityEvents: events.filter((e) => e.eventType === 'priority_changed'), row };
		});

		expect(row?.priority).toBe('urgent');
		// Both changes collapse into a single row: original oldValue kept, latest newValue taken.
		expect(priorityEvents).toHaveLength(1);
		expect(priorityEvents[0].metadata).toMatchObject({ newValue: 'urgent', oldValue: 'none' });
	});

	it('rejects an unauthenticated priority change', async () => {
		const t = convexTest();
		const seed = await t.run((baseCtx) => runCtx(baseCtx).then(seedAuthedOrgAdmin));
		await expect(
			t.mutation(api.feedback.updatePriority, { id: seed.feedbackId, priority: 'high' })
		).rejects.toThrow(/UNAUTHORIZED|authenticated/i);
	});
});
