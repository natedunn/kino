import { Navigate, createFileRoute } from '@tanstack/react-router';

import { titleFromSlug, titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/@{$org}/integrations/github/')({
	head: ({ params }) => ({
		meta: [titleMeta(['GitHub Integration', titleFromSlug(params.org)])],
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
		<Navigate search={{ github: search.github, org: params.org }} to='/org/settings/integrations' />
	);
}
