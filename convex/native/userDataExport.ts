import { ConvexError, v } from 'convex/values';

import { query } from './_generated/server';
import { requireCurrentUser } from './identity';
import { feedbackStatus, projectVisibility, updateCategory, updateStatus } from './schema';
import {
	buildCommentsSection,
	EXPORT_FORMAT,
	EXPORT_VERSION,
	exportSectionIds,
	MAX_EXPORT_BYTES,
	resolveRequestedSections,
} from './userDataExport.lib';

const sectionId = v.literal('comments');
const sectionDefinition = v.object({
	id: sectionId,
	label: v.string(),
	description: v.string(),
	includedByDefault: v.boolean(),
});
const organizationSummary = v.union(
	v.null(),
	v.object({ id: v.id('organizations'), name: v.string(), slug: v.string() })
);
const projectSummary = v.object({
	id: v.id('projects'),
	name: v.string(),
	orgSlug: v.string(),
	slug: v.string(),
	visibility: projectVisibility,
});
const feedbackContext = v.union(
	v.object({ contextAccess: v.literal('missing'), feedbackId: v.id('feedback') }),
	v.object({
		contextAccess: v.literal('inaccessible'),
		feedbackId: v.id('feedback'),
		projectId: v.id('projects'),
	}),
	v.object({
		contextAccess: v.literal('visible'),
		board: v.union(
			v.null(),
			v.object({ id: v.id('feedbackBoards'), name: v.string(), slug: v.string() })
		),
		feedback: v.object({
			id: v.id('feedback'),
			slug: v.string(),
			status: feedbackStatus,
			title: v.string(),
		}),
		organization: organizationSummary,
		project: projectSummary,
	})
);
const updateContext = v.union(
	v.object({ contextAccess: v.literal('missing'), updateId: v.id('updates') }),
	v.object({
		contextAccess: v.literal('inaccessible'),
		projectId: v.id('projects'),
		updateId: v.id('updates'),
	}),
	v.object({
		contextAccess: v.literal('visible'),
		organization: organizationSummary,
		project: projectSummary,
		update: v.object({
			category: updateCategory,
			id: v.id('updates'),
			publishedAt: v.union(v.string(), v.null()),
			slug: v.string(),
			status: updateStatus,
			title: v.string(),
		}),
	})
);
const commentsSection = v.object({
	version: v.number(),
	counts: v.object({
		feedbackComments: v.number(),
		updateComments: v.number(),
		total: v.number(),
	}),
	feedbackComments: v.array(
		v.object({
			id: v.id('feedbackComments'),
			content: v.string(),
			createdAt: v.union(v.string(), v.null()),
			updatedAt: v.union(v.string(), v.null()),
			feedbackId: v.id('feedback'),
			initial: v.boolean(),
			replyFeedbackCommentId: v.union(v.id('feedbackComments'), v.null()),
			source: v.literal('feedback'),
			context: feedbackContext,
		})
	),
	updateComments: v.array(
		v.object({
			id: v.id('updateComments'),
			content: v.string(),
			createdAt: v.union(v.string(), v.null()),
			updatedAt: v.union(v.string(), v.null()),
			updateId: v.id('updates'),
			source: v.literal('update'),
			context: updateContext,
		})
	),
});

export const getAvailableSections = query({
	args: {},
	returns: v.array(sectionDefinition),
	handler: async (ctx) => {
		await requireCurrentUser(ctx);
		return exportSectionIds.map((id) => ({
			id,
			label: 'Comments',
			description:
				'Your feedback and update comments, with the visible project context needed to understand them.',
			includedByDefault: true,
		}));
	},
});

export const exportData = query({
	args: { sections: v.optional(v.array(sectionId)) },
	returns: v.object({
		format: v.literal(EXPORT_FORMAT),
		version: v.number(),
		generatedAt: v.string(),
		account: v.object({
			userId: v.id('users'),
			profileId: v.id('profiles'),
			username: v.string(),
			email: v.union(v.string(), v.null()),
		}),
		sections: v.object({ comments: v.optional(commentsSection) }),
	}),
	handler: async (ctx, args) => {
		const user = await requireCurrentUser(ctx);
		if (!user.profileId) throw new ConvexError('PROFILE_NOT_FOUND');
		const profile = await ctx.db.get('profiles', user.profileId);
		if (!profile || profile.userId !== user._id) throw new ConvexError('PROFILE_NOT_FOUND');

		const requestedSections = resolveRequestedSections(args.sections);
		const sections: { comments?: Awaited<ReturnType<typeof buildCommentsSection>> } = {};
		if (requestedSections.includes('comments')) {
			sections.comments = await buildCommentsSection(ctx, profile);
		}
		const exportDocument = {
			format: EXPORT_FORMAT,
			version: EXPORT_VERSION,
			generatedAt: new Date().toISOString(),
			account: {
				userId: user._id,
				profileId: profile._id,
				username: profile.username,
				email:
					user.passwordEmailVerifiedAt !== undefined
						? (user.passwordEmail ?? null)
						: (user.githubEmail ?? null),
			},
			sections,
		};
		if (new TextEncoder().encode(JSON.stringify(exportDocument)).length > MAX_EXPORT_BYTES) {
			throw new ConvexError({
				code: 'BAD_REQUEST',
				message:
					'Your export is too large for immediate download. Try again after async exports are available.',
			});
		}
		return exportDocument;
	},
});
