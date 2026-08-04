// @vitest-environment edge-runtime
import { eq } from 'kitcn/orm';
import { describe, expect, it } from 'vitest';

import { api } from './_generated/api';
import {
	feedbackTable,
	memberTable,
	organizationTable,
	profileTable,
	projectTable,
	sessionTable,
	updateCommentTable,
	updateTable,
	userTable,
} from './schema';
import { convexTest, runCtx } from './setup.testing';

type Ctx = Awaited<ReturnType<typeof runCtx>>;

// Seed a full authenticated org-admin: user + profile + org + admin membership +
// a session row (so the kitcn auth chain — getHeaders → session.token → Bearer →
// auth.api.getSession — resolves), then a project and a feedback row.
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
		organizationId: organization.id,
		profileId: profile.id,
		projectId: project.id,
		sessionId: session.id,
		userId: user.id,
	};
}

describe('organization invitations (authenticated end-to-end)', () => {
	// Invitees are identified by email only — they do not need a Kino account
	// yet. This exercises the full better-auth createInvitation path, which
	// broke when the org plugin passed its own generated id to the Convex
	// adapter (Convex owns document IDs).
	it('creates a pending invitation for an email without a Kino account', async () => {
		const t = convexTest();
		const seed = await t.run((baseCtx) => runCtx(baseCtx).then(seedAuthedOrgAdmin));
		const asUser = t.withIdentity({
			sessionId: seed.sessionId,
			subject: seed.userId,
		});

		await asUser.mutation(api.orgMember.inviteMember, {
			email: 'newcomer@example.com',
			organizationId: seed.organizationId,
			// Untrusted origin: the server must fall back to SITE_URL rather than
			// reject the invite or trust the value.
			origin: 'https://evil.example.com',
			role: 'admin',
		});

		const invitations = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const rows = await ctx.orm.query.invitation.findMany({
				where: { organizationId: seed.organizationId },
				limit: 10,
			});
			// ORM rows carry Date objects, which t.run can't serialize back out.
			return rows.map((row: any) => ({ email: row.email, status: row.status }));
		});
		expect(invitations).toHaveLength(1);
		expect(invitations[0].email).toBe('newcomer@example.com');
		expect(invitations[0].status).toBe('pending');
	});

	it('rejects a moderator invite with no projects', async () => {
		const t = convexTest();
		const seed = await t.run((baseCtx) => runCtx(baseCtx).then(seedAuthedOrgAdmin));
		const asUser = t.withIdentity({
			sessionId: seed.sessionId,
			subject: seed.userId,
		});

		await expect(
			asUser.mutation(api.orgMember.inviteMember, {
				email: 'mod@example.com',
				organizationId: seed.organizationId,
				projectIds: [],
				role: 'moderator',
			})
		).rejects.toThrow(/at least one project/i);
	});
});

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
			const feedbackRow = await ctx.orm.query.feedback.findFirst({
				where: { id: seed.feedbackId },
			});
			const feedbackEvents = await ctx.orm.query.feedbackEvent.findMany({
				where: { feedbackId: seed.feedbackId },
				limit: 10,
			});
			return { events: feedbackEvents, row: feedbackRow };
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
			const feedbackRow = await ctx.orm.query.feedback.findFirst({
				where: { id: seed.feedbackId },
			});
			const events = await ctx.orm.query.feedbackEvent.findMany({
				where: { feedbackId: seed.feedbackId },
				limit: 10,
			});
			return {
				priorityEvents: events.filter((e) => e.eventType === 'priority_changed'),
				row: feedbackRow,
			};
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

async function archiveSeededProject(t: ReturnType<typeof convexTest>, projectId: string) {
	await t.run(async (baseCtx) => {
		const ctx = await runCtx(baseCtx);
		await ctx.orm
			.update(projectTable)
			.set({ visibility: 'archived' })
			.where(eq(projectTable.id, projectId));
	});
}

describe('archived projects are frozen (end-to-end)', () => {
	it('rejects content writes even for an org admin', async () => {
		const t = convexTest();
		const seed = await t.run((baseCtx) => runCtx(baseCtx).then(seedAuthedOrgAdmin));
		await archiveSeededProject(t, seed.projectId);
		const asUser = t.withIdentity({ sessionId: seed.sessionId, subject: seed.userId });

		// A feedback write (org admin would normally be allowed) is blocked...
		await expect(
			asUser.mutation(api.feedback.updatePriority, { id: seed.feedbackId, priority: 'high' })
		).rejects.toThrow(/archived/i);
		// ...and so is creating a comment.
		await expect(
			asUser.mutation(api.feedbackComment.create, {
				content: 'hello',
				feedbackId: seed.feedbackId,
			})
		).rejects.toThrow(/archived/i);
	});

	it('lets an admin un-archive (visibility only)', async () => {
		const t = convexTest();
		const seed = await t.run((baseCtx) => runCtx(baseCtx).then(seedAuthedOrgAdmin));
		await archiveSeededProject(t, seed.projectId);
		const asUser = t.withIdentity({ sessionId: seed.sessionId, subject: seed.userId });

		await asUser.mutation(api.project.update, { id: seed.projectId, visibility: 'public' });

		const project = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			return ctx.orm.query.project.findFirst({ where: { id: seed.projectId } });
		});
		expect(project?.visibility).toBe('public');
	});

	it('rejects update and update-comment reactions', async () => {
		const t = convexTest();
		const seed = await t.run((baseCtx) => runCtx(baseCtx).then(seedAuthedOrgAdmin));
		const { updateCommentId, updateId } = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const [update] = await ctx.orm
				.insert(updateTable)
				.values({
					authorProfileId: seed.profileId,
					category: 'changelog',
					content: 'Update body',
					projectId: seed.projectId,
					slug: 'update-1',
					status: 'published',
					title: 'Update 1',
					updatedTime: Date.now(),
				})
				.returning();
			const [comment] = await ctx.orm
				.insert(updateCommentTable)
				.values({
					authorProfileId: seed.profileId,
					content: 'Update comment',
					updateId: update.id,
				})
				.returning();
			return { updateCommentId: comment.id, updateId: update.id };
		});
		await archiveSeededProject(t, seed.projectId);
		const asUser = t.withIdentity({ sessionId: seed.sessionId, subject: seed.userId });

		await expect(
			asUser.mutation(api.updateEmote.toggle, {
				content: 'heart',
				updateId,
			})
		).rejects.toThrow(/archived/i);
		await expect(
			asUser.mutation(api.updateCommentEmote.toggle, {
				content: 'heart',
				updateCommentId,
				updateId,
			})
		).rejects.toThrow(/archived/i);
	});

	it('rejects a non-visibility project edit while archived', async () => {
		const t = convexTest();
		const seed = await t.run((baseCtx) => runCtx(baseCtx).then(seedAuthedOrgAdmin));
		await archiveSeededProject(t, seed.projectId);
		const asUser = t.withIdentity({ sessionId: seed.sessionId, subject: seed.userId });

		await expect(
			asUser.mutation(api.project.update, { id: seed.projectId, name: 'Renamed' })
		).rejects.toThrow(/archived/i);
	});
});
