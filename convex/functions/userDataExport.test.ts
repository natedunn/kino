// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest';

import { api } from './_generated/api';
import {
	feedbackBoardTable,
	feedbackCommentTable,
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

async function seedUser(ctx: Ctx, args: { email: string; name: string; username: string }) {
	const [user] = await ctx.orm
		.insert(userTable)
		.values({
			createdAt: new Date(),
			email: args.email,
			emailVerified: true,
			name: args.name,
			updatedAt: new Date(),
		})
		.returning();
	const [profile] = await ctx.orm
		.insert(profileTable)
		.values({
			email: args.email,
			name: args.name,
			role: 'user',
			userId: user.id,
			username: args.username,
		})
		.returning();
	const [session] = await ctx.orm
		.insert(sessionTable)
		.values({
			createdAt: new Date(),
			expiresAt: new Date(Date.now() + 86_400_000),
			token: `${args.username}-session-token`,
			updatedAt: new Date(),
			userId: user.id,
		})
		.returning();

	return { profile, session, user };
}

async function seedOrgProject(
	ctx: Ctx,
	args: {
		orgSlug: string;
		ownerUserId?: string;
		projectSlug: string;
		visibility?: 'archived' | 'private' | 'public';
	}
) {
	const [organization] = await ctx.orm
		.insert(organizationTable)
		.values({
			createdAt: new Date(),
			name: args.orgSlug.toUpperCase(),
			slug: args.orgSlug,
			visibility: 'public',
		})
		.returning();

	if (args.ownerUserId) {
		await ctx.orm.insert(memberTable).values({
			createdAt: new Date(),
			organizationId: organization.id,
			role: 'admin',
			userId: args.ownerUserId,
		});
	}

	const [project] = await ctx.orm
		.insert(projectTable)
		.values({
			name: args.projectSlug.toUpperCase(),
			orgSlug: organization.slug,
			slug: args.projectSlug,
			visibility: args.visibility ?? 'public',
		})
		.returning();

	return { organization, project };
}

async function seedFeedbackComment(
	ctx: Ctx,
	args: {
		boardSlug?: string;
		content: string;
		profileId: string;
		projectId: string;
		title: string;
	}
) {
	const [board] = await ctx.orm
		.insert(feedbackBoardTable)
		.values({
			name: 'Bugs',
			projectId: args.projectId,
			slug: args.boardSlug ?? 'bugs',
		})
		.returning();
	const [feedback] = await ctx.orm
		.insert(feedbackTable)
		.values({
			authorProfileId: args.profileId,
			boardId: board.id,
			projectId: args.projectId,
			slug: args.title.toLowerCase().replaceAll(' ', '-'),
			status: 'open',
			title: args.title,
			upvotes: 0,
		})
		.returning();
	const [comment] = await ctx.orm
		.insert(feedbackCommentTable)
		.values({
			authorProfileId: args.profileId,
			content: args.content,
			feedbackId: feedback.id,
			initial: false,
		})
		.returning();

	return { board, comment, feedback };
}

async function seedUpdateComment(
	ctx: Ctx,
	args: {
		content: string;
		profileId: string;
		projectId: string;
		status?: 'draft' | 'published';
		title: string;
	}
) {
	const [update] = await ctx.orm
		.insert(updateTable)
		.values({
			authorProfileId: args.profileId,
			category: 'announcement',
			content: 'Update body',
			projectId: args.projectId,
			relatedFeedbackIds: [],
			slug: args.title.toLowerCase().replaceAll(' ', '-'),
			status: args.status ?? 'published',
			tags: [],
			title: args.title,
			updatedTime: Date.now(),
		})
		.returning();
	const [comment] = await ctx.orm
		.insert(updateCommentTable)
		.values({
			authorProfileId: args.profileId,
			content: args.content,
			updateId: update.id,
		})
		.returning();

	return { comment, update };
}

describe('user data export', () => {
	it('rejects unauthenticated exports', async () => {
		const t = convexTest();

		await expect(t.query(api.userDataExport.exportData, {})).rejects.toThrow(
			/UNAUTHORIZED|authenticated/i
		);
	});

	it("exports only the signed-in user's comments with visible context", async () => {
		const t = convexTest();
		const seed = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const owner = await seedUser(ctx, {
				email: 'owner@example.com',
				name: 'Owner',
				username: 'owner',
			});
			const other = await seedUser(ctx, {
				email: 'other@example.com',
				name: 'Other',
				username: 'other',
			});
			const { project } = await seedOrgProject(ctx, {
				orgSlug: 'acme',
				ownerUserId: owner.user.id,
				projectSlug: 'roadmap',
			});

			await seedFeedbackComment(ctx, {
				content: 'Please fix this',
				profileId: owner.profile.id,
				projectId: project.id,
				title: 'Feedback A',
			});
			await seedFeedbackComment(ctx, {
				content: "Someone else's feedback comment",
				profileId: other.profile.id,
				projectId: project.id,
				title: 'Feedback B',
			});
			await seedUpdateComment(ctx, {
				content: 'Looks good',
				profileId: owner.profile.id,
				projectId: project.id,
				title: 'Launch Notes',
			});
			await seedUpdateComment(ctx, {
				content: "Someone else's update comment",
				profileId: other.profile.id,
				projectId: project.id,
				title: 'Other Notes',
			});

			return {
				sessionId: owner.session.id,
				userId: owner.user.id,
			};
		});
		const asOwner = t.withIdentity({
			sessionId: seed.sessionId,
			subject: seed.userId,
		});

		const result = await asOwner.query(api.userDataExport.exportData, {});

		expect(result.format).toBe('kino-user-data-export');
		expect(result.account.username).toBe('owner');
		expect(result.sections.comments.counts).toEqual({
			feedbackComments: 1,
			total: 2,
			updateComments: 1,
		});
		expect(result.sections.comments.feedbackComments[0].content).toBe('Please fix this');
		expect(result.sections.comments.feedbackComments[0].context).toMatchObject({
			contextAccess: 'visible',
			feedback: { title: 'Feedback A' },
			project: { slug: 'roadmap' },
		});
		expect(result.sections.comments.updateComments[0].content).toBe('Looks good');
		expect(result.sections.comments.updateComments[0].context).toMatchObject({
			contextAccess: 'visible',
			update: { title: 'Launch Notes' },
			project: { slug: 'roadmap' },
		});
	});

	it('omits private parent context when the user no longer has access', async () => {
		const t = convexTest();
		const seed = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const user = await seedUser(ctx, {
				email: 'author@example.com',
				name: 'Author',
				username: 'author',
			});
			const { project } = await seedOrgProject(ctx, {
				orgSlug: 'private-org',
				projectSlug: 'private-project',
				visibility: 'private',
			});

			await seedFeedbackComment(ctx, {
				content: 'Private feedback comment',
				profileId: user.profile.id,
				projectId: project.id,
				title: 'Private Feedback',
			});
			await seedUpdateComment(ctx, {
				content: 'Private draft update comment',
				profileId: user.profile.id,
				projectId: project.id,
				status: 'draft',
				title: 'Private Draft',
			});

			return {
				sessionId: user.session.id,
				userId: user.user.id,
			};
		});
		const asUser = t.withIdentity({
			sessionId: seed.sessionId,
			subject: seed.userId,
		});

		const result = await asUser.query(api.userDataExport.exportData, {});

		expect(result.sections.comments.feedbackComments[0].context).toMatchObject({
			contextAccess: 'inaccessible',
		});
		expect(result.sections.comments.updateComments[0].context).toMatchObject({
			contextAccess: 'inaccessible',
		});
	});
});
