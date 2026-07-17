import { createFileRoute, Navigate } from '@tanstack/react-router';

import { projectTitle, titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/@{$org}/$project/feedback/boards/')({
	head: ({ params }) => ({
		meta: [titleMeta(['Boards', 'Feedback', projectTitle(params.org, params.project)])],
	}),
	component: BoardsRedirectRoute,
});

function BoardsRedirectRoute() {
	const params = Route.useParams();
	return <Navigate params={params} to='/@{$org}/$project/settings/boards' />;
}
