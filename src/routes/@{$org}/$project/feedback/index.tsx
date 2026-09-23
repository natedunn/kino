import { convexQuery } from '@convex-dev/react-query';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { RoutePending } from '@/components/route-pending';
import { projectTitle, titleMeta } from '@/lib/seo';
import * as m from '@/paraglide/messages.js';

import { api as nativeApi } from '../../../../../convex/native/_generated/api';
import { NativeFeedbackListRoute } from './-components/native-feedback-list';

const NUM_OF_ITEMS_PER_PAGE = 50;

type FeedbackStatus = 'open' | 'in-progress' | 'closed' | 'completed' | 'paused';
type FeedbackSearch = {
	board?: string;
	search?: string;
	status?: FeedbackStatus;
};

const FEEDBACK_STATUSES = new Set<FeedbackStatus>([
	'open',
	'in-progress',
	'closed',
	'completed',
	'paused',
]);

function parseOptionalString(value: unknown) {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed === '' ? undefined : trimmed;
}

function validateFeedbackSearch(search: Record<string, unknown>): FeedbackSearch {
	const status = parseOptionalString(search.status);
	const board = parseOptionalString(search.board);
	const query = parseOptionalString(search.search);

	return {
		...(board ? { board } : {}),
		...(query ? { search: query } : {}),
		status:
			status && FEEDBACK_STATUSES.has(status as FeedbackStatus)
				? (status as FeedbackStatus)
				: undefined,
	};
}

export const Route = createFileRoute('/@{$org}/$project/feedback/')({
	component: NativeFeedbackListRoute,
	loaderDeps: ({ search }) => ({
		board: search.board,
		search: search.search,
		status: search.status,
	}),
	loader: async ({ context, deps, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			convexQuery(nativeApi.projects.getBySlugs, {
				organizationSlug: params.org,
				projectSlug: params.project,
			})
		);
		if (!projectData?.project) throw notFound();
		const boards = await context.queryClient.ensureQueryData(
			convexQuery(nativeApi.feedbackBoards.list, { projectId: projectData.project.id })
		);
		const boardId = boards?.find(
			(item: { id: string; slug: string }) => item.slug === deps.board
		)?.id;
		const options = convexQuery(nativeApi.feedback.list, {
			projectId: projectData.project.id,
			...(boardId ? { boardId } : {}),
			...(deps.search ? { search: deps.search } : {}),
			...(deps.status ? { status: deps.status } : {}),
			paginationOpts: { cursor: null, numItems: NUM_OF_ITEMS_PER_PAGE },
		});
		if (typeof window === 'undefined') {
			await context.queryClient.ensureQueryData(options).catch(() => undefined);
		} else {
			void context.queryClient.prefetchQuery(options);
		}
	},
	pendingComponent: () => <RoutePending variant='sidebar' />,
	validateSearch: validateFeedbackSearch,
	head: ({ params }) => ({
		meta: [titleMeta([m.project_nav_feedback(), projectTitle(params.org, params.project)])],
	}),
});
