import { createFileRoute, Navigate } from '@tanstack/react-router';

import { projectTitle, titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/@{$org}/$project/integrations/github/')({
	head: ({ params }) => ({
		meta: [titleMeta(['GitHub Integration', projectTitle(params.org, params.project)])],
	}),
	component: GitHubIntegrationRedirectRoute,
});

function GitHubIntegrationRedirectRoute() {
	const params = Route.useParams();
	const search = Route.useSearch() as { github?: string };

	return (
		<Navigate
			params={params}
			search={{ github: search.github }}
			to='/@{$org}/$project/settings/integrations'
		/>
	);
}
