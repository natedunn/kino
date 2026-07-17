import { createFileRoute, Navigate } from '@tanstack/react-router';

import { titleFromSlug, titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/@{$org}/integrations/github/')({
	head: ({ params }) => ({
		meta: [titleMeta(['GitHub Integration', titleFromSlug(params.org)])],
	}),
	component: GitHubIntegrationRedirectRoute,
});

function GitHubIntegrationRedirectRoute() {
	const params = Route.useParams();
	const search = Route.useSearch() as { github?: string };

	return (
		<Navigate search={{ github: search.github, org: params.org }} to='/org/settings/integrations' />
	);
}
