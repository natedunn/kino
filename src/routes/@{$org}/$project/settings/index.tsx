import { createFileRoute, Navigate } from '@tanstack/react-router';

import { titleMeta } from '@/lib/seo';
import * as m from '@/paraglide/messages.js';

export const Route = createFileRoute('/@{$org}/$project/settings/')({
	head: () => ({
		meta: [titleMeta([m.meta_settings()])],
	}),
	component: ProjectSettingsIndexRoute,
});

function ProjectSettingsIndexRoute() {
	const params = Route.useParams();
	return <Navigate params={params} to='/@{$org}/$project/settings/general' />;
}
