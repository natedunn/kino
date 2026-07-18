import { Navigate, createFileRoute } from '@tanstack/react-router';

import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/org/settings/')({
	head: () => ({
		meta: [titleMeta(['Settings'])],
	}),
	component: OrgSettingsIndexRoute,
});

function OrgSettingsIndexRoute() {
	const search = Route.useSearch();
	return <Navigate replace search={{ org: search.org }} to='/org/settings/general' />;
}
