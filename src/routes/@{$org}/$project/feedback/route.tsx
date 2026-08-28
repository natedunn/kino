import { useCallback, useMemo } from 'react';
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';

import { useRegisterCommands } from '@/components/command';
import { useRegisterShortcuts } from '@/components/shortcuts';
import { CirclePlusOutline18 } from '@/icons/nucleo/CirclePlusOutline18';
import { projectTitle, titleMeta } from '@/lib/seo';
import * as m from '@/paraglide/messages.js';

export const Route = createFileRoute('/@{$org}/$project/feedback')({
	head: ({ params }) => ({
		meta: [titleMeta([m.project_nav_feedback(), projectTitle(params.org, params.project)])],
	}),
	component: FeedbackRoute,
});

function FeedbackRoute() {
	const navigate = useNavigate();
	const params = Route.useParams();

	const goToNewFeedback = useCallback(
		() =>
			navigate({
				params,
				to: '/@{$org}/$project/feedback/new',
			}),
		[navigate, params]
	);

	const commands = useMemo(
		() => [
			{
				group: 'Feedback' as const,
				icon: CirclePlusOutline18,
				id: 'feedback.add',
				keywords: ['create', 'new', 'request'],
				shortcut: 'N',
				title: m.feedback_index_add_feedback(),
				run: goToNewFeedback,
			},
		],
		[goToNewFeedback]
	);

	const shortcuts = useMemo(
		() => [
			{
				group: 'Feedback' as const,
				id: 'feedback.new',
				keys: ['n'],
				description: m.feedback_new_shortcut(),
				run: goToNewFeedback,
			},
		],
		[goToNewFeedback]
	);

	useRegisterCommands('feedback', commands);
	useRegisterShortcuts('feedback', shortcuts);

	return <Outlet />;
}
