import { Navigate, createFileRoute } from '@tanstack/react-router';

import { projectTitle, titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/@{$org}/$project/integrations/github/')({
	head: ({ params }) => ({
		meta: [titleMeta(['GitHub Integration', projectTitle(params.org, params.project)])],
	}),
	component: GitHubIntegrationRedirectRoute,
});

function GitHubIntegrationRedirectRoute() {
	const params = Route.useParams();
	// `tsc` infers `{}` for this route's search params, so the cast IS required even
	// though eslint's type info thinks it's redundant.
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
	const search = Route.useSearch() as { github?: string };

	return (
		<Navigate
			params={params}
			search={{ github: search.github }}
			to='/@{$org}/$project/settings/integrations'
		/>
	);
}
