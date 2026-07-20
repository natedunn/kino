import { createFileRoute, Navigate } from '@tanstack/react-router';

import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/@{$org}/$project/settings/')({
	head: () => ({
		meta: [titleMeta(['Settings'])],
	}),
	component: ProjectSettingsIndexRoute,
});

function ProjectSettingsIndexRoute() {
	const params = Route.useParams();
	return <Navigate params={params} to='/@{$org}/$project/settings/general' />;
}
