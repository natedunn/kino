// @vitest-environment edge-runtime
import { eq } from 'kitcn/orm';
import { describe, expect, it } from 'vitest';

import { api } from './_generated/api';
import {
	feedbackCommentTable,
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

// Seed an authed org-admin + a project + a feedback whose thread is a mix of
// comments and events, so we can exercise the merged (comment + event) timeline
// window and its middle pagination. `commentCount`/`eventCount` are interleaved.
async function seedThread(ctx: Ctx, commentCount: number, eventCount: number) {
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
		.values({ createdAt: new Date(), name: 'Acme', slug: 'acme', visibility: 'public' })
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
		.values({ name: 'Proj', orgSlug: organization.slug, slug: 'proj', visibility: 'public' })
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

	// Pinned initial comment.
	const [initialComment] = await ctx.orm
		.insert(feedbackCommentTable)
		.values({
			authorProfileId: profile.id,
			content: 'opened',
			feedbackId: feedback.id as any,
			initial: true,
		})
		.returning();
	await ctx.orm
		.update(feedbackTable)
		.set({ firstCommentId: initialComment.id as any })
		.where(eq(feedbackTable.id, feedback.id));

	// Interleave the remaining comments and events so both kinds land throughout
	// the timeline.
	const expectedIds = new Set<string>();
	const max = Math.max(commentCount, eventCount);
	for (let index = 0; index < max; index++) {
		if (index < commentCount) {
			const [comment] = await ctx.orm
				.insert(feedbackCommentTable)
				.values({
					authorProfileId: profile.id,
					content: `comment ${index}`,
					feedbackId: feedback.id as any,
					initial: false,
				})
				.returning();
			expectedIds.add(String(comment.id));
		}
		if (index < eventCount) {
			const [event] = await ctx.orm
				.insert(feedbackEventTable)
				.values({
					actorProfileId: profile.id as any,
					eventType: 'status_changed',
					feedbackId: feedback.id as any,
					metadata: { newValue: `s${index}`, oldValue: `s${index - 1}` },
					updatedTime: Date.now(),
				})
				.returning();
			expectedIds.add(String(event.id));
		}
	}

	return {
		expectedIds: Array.from(expectedIds),
		initialCommentId: String(initialComment.id),
		projectId: project.id,
		sessionId: session.id,
		slug: feedback.slug,
		userId: user.id,
	};
}

async function collectMiddle(
	asUser: ReturnType<ReturnType<typeof convexTest>['withIdentity']>,
	feedbackId: string,
	startCursor: string,
	endCursor: string | null
) {
	const items: Array<{ id: string; type: string; createdAt: number }> = [];
	let cursor: string | null = startCursor;
	let guard = 0;
	while (cursor && guard < 50) {
		guard++;
		const page: { items: Array<any>; nextCursor: string | null } = await asUser.query(
			api.feedback.getMiddleComments,
			{ cursor, endCursor, feedbackId }
		);
		items.push(...page.items);
		cursor = page.nextCursor;
	}
	return items;
}

describe('feedback merged timeline', () => {
	it('windows comments + events with head/tail and a paginable middle', async () => {
		const t = convexTest();
		const seed = await t.run((baseCtx) => runCtx(baseCtx).then((ctx) => seedThread(ctx, 12, 12)));
		const asUser = t.withIdentity({ sessionId: seed.sessionId, subject: seed.userId });

		const detail: any = await asUser.query(api.feedback.getDetailCritical, {
			projectId: seed.projectId,
			slug: seed.slug,
		});

		// The pinned initial comment is returned separately, never inside the timeline.
		expect(detail.firstComment?.id).toBe(seed.initialCommentId);
		expect(detail.timeline.head).toHaveLength(5);
		expect(detail.timeline.tail).toHaveLength(10);
		expect(typeof detail.timeline.middleCursor).toBe('string');
		expect(typeof detail.timeline.middleEndCursor).toBe('string');

		const middle = await collectMiddle(
			asUser,
			detail.feedback.id as string,
			detail.timeline.middleCursor,
			detail.timeline.middleEndCursor
		);

		const merged = [...detail.timeline.head, ...middle, ...detail.timeline.tail];
		const ids = merged.map((item: any) => item.id);
		const uniqueIds = new Set(ids);

		// No duplicates, no initial comment, and every inserted item is present exactly once.
		expect(uniqueIds.size).toBe(ids.length);
		expect(uniqueIds.has(seed.initialCommentId)).toBe(false);
		expect(uniqueIds).toEqual(new Set(seed.expectedIds));

		// Both kinds are interleaved, and the merged sequence is chronologically ordered.
		expect(merged.some((item: any) => item.type === 'comment')).toBe(true);
		expect(merged.some((item: any) => item.type === 'event')).toBe(true);
		const sorted = merged.every(
			(item: any, index: number) => index === 0 || merged[index - 1].createdAt <= item.createdAt
		);
		expect(sorted).toBe(true);
	});

	it('has no middle when the thread fits within head + tail', async () => {
		const t = convexTest();
		const seed = await t.run((baseCtx) => runCtx(baseCtx).then((ctx) => seedThread(ctx, 3, 2)));
		const asUser = t.withIdentity({ sessionId: seed.sessionId, subject: seed.userId });

		const detail: any = await asUser.query(api.feedback.getDetailCritical, {
			projectId: seed.projectId,
			slug: seed.slug,
		});

		expect(detail.timeline.middleCursor).toBeNull();
		const merged = [...detail.timeline.head, ...detail.timeline.tail];
		const uniqueIds = new Set(merged.map((item: any) => item.id));
		// Short thread: head/tail together cover every item exactly once.
		expect(uniqueIds).toEqual(new Set(seed.expectedIds));
	});
});
