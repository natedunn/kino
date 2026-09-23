import { convexQuery } from '@convex-dev/react-query';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { projectTitle, titleFromSlug, titleMeta } from '@/lib/seo';

import { api as nativeApi } from '../../../../../../convex/native/_generated/api';
import { NativeFeedbackDetailRoute } from './-components/native-feedback-detail';

export const Route = createFileRoute('/@{$org}/$project/feedback/$slug/')({
	component: NativeFeedbackDetailRoute,
	loader: async ({ context, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			convexQuery(nativeApi.projects.getBySlugs, {
				organizationSlug: params.org,
				projectSlug: params.project,
			})
		);
		if (!projectData?.project.id) throw notFound();
		const [feedbackData] = await Promise.all([
			context.queryClient.ensureQueryData(
				convexQuery(nativeApi.feedback.getDetail, {
					projectId: projectData.project.id,
					slug: params.slug,
				})
			),
			context.queryClient.ensureQueryData(
				convexQuery(nativeApi.feedbackBoards.list, { projectId: projectData.project.id })
			),
			context.queryClient.ensureQueryData(
				convexQuery(nativeApi.feedback.listAssignableProfiles, {
					projectId: projectData.project.id,
				})
			),
			context.queryClient.ensureQueryData(
				convexQuery(nativeApi.feedback.searchForLinking, {
					projectId: projectData.project.id,
					search: '',
				})
			),
		]);
		if (!feedbackData?.feedback) throw notFound();
		return {
			createdAt: 0,
			feedbackId: feedbackData.feedback.id,
			projectId: projectData.project.id,
			status: feedbackData.feedback.status,
			title: feedbackData.feedback.title,
			upvotes: feedbackData.feedback.upvotes,
		};
	},
	head: ({ loaderData, params }) => ({
		meta: [
			titleMeta([
				loaderData?.title ?? titleFromSlug(params.slug),
				projectTitle(params.org, params.project),
			]),
		],
	}),
});
