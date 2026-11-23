import { ConvexError, v } from 'convex/values';

import { VALIDATION_LIMITS } from '../shared/validation';
import { mutation } from './_generated/server';
import { assertProjectWritable, requireProjectAccess } from './access';
import { recordEvent as recordFeedbackEvent } from './feedback';
import { isFeedbackLive } from './feedbackLifecycle';
import {
	actor,
	forumEnabled,
	insertTopic,
	liveCategory,
	MAX_CONTENT,
	recordEvent,
	validateContent,
	validateTitle,
} from './forum';

// The reverse of `forum.convertToFeedback`: questions and conversations filed
// as feedback move to a topic that copies the title and opening post (credited
// to the original author). Both are linked, and the feedback is closed so the
// conversation continues in the forum.
export const moveFromFeedback = mutation({
	args: { feedbackId: v.id('feedback'), categoryId: v.id('forumCategories') },
	returns: v.object({ topicSlug: v.string() }),
	handler: async (ctx, args) => {
		const profileId = await actor(ctx);
		const feedback = await ctx.db.get('feedback', args.feedbackId);
		if (!feedback || !(await isFeedbackLive(ctx, feedback)))
			throw new ConvexError('FEEDBACK_NOT_FOUND');
		const access = await requireProjectAccess(ctx, feedback.projectId);
		assertProjectWritable(access);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		if (!forumEnabled(access.project)) throw new ConvexError('FORUM_DISABLED');
		if (feedback.movedToTopicId) {
			const moved = await ctx.db.get('forumTopics', feedback.movedToTopicId);
			if (moved && moved.deletingAt === undefined) throw new ConvexError('ALREADY_MOVED');
		}
		// Managers may file into team-only categories, so only liveness is checked.
		const category = await liveCategory(ctx, feedback.projectId, args.categoryId);
		const first = feedback.firstCommentId
			? await ctx.db.get('feedbackComments', feedback.firstCommentId)
			: null;
		if (!first) throw new ConvexError('COMMENT_NOT_FOUND');
		const title = validateTitle(feedback.title.slice(0, VALIDATION_LIMITS.forumTopicTitle));
		const topic = await insertTopic(ctx, {
			projectId: feedback.projectId,
			categoryId: category._id,
			authorProfileId: feedback.authorProfileId,
			title,
			// Feedback bodies may run past the forum editor's visible-text limit;
			// keep them whole, bounded only by the stored-HTML cap.
			body: validateContent(first.content, MAX_CONTENT),
		});
		await ctx.db.insert('forumLinks', {
			projectId: feedback.projectId,
			topicId: topic.id,
			feedbackId: feedback._id,
			createdByProfileId: profileId,
		});
		await recordEvent(ctx, topic.id, profileId, 'imported_from_feedback', {
			feedbackId: feedback._id,
		});
		await ctx.db.patch('feedback', feedback._id, {
			movedToTopicId: topic.id,
			status: 'closed',
			updatedAt: Date.now(),
		});
		await recordFeedbackEvent(ctx, {
			actorProfileId: profileId,
			feedbackId: feedback._id,
			eventType: 'moved_to_forum',
			metadata: { topicId: topic.id, newValue: title },
		});
		// Moving closes the feedback; record it like a manual status change.
		if (feedback.status !== 'closed')
			await recordFeedbackEvent(ctx, {
				actorProfileId: profileId,
				feedbackId: feedback._id,
				eventType: 'status_changed',
				metadata: { oldValue: feedback.status, newValue: 'closed' },
			});
		return { topicSlug: topic.slug };
	},
});
