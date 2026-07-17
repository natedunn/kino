import { createFileRoute, Navigate } from '@tanstack/react-router';

import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/account/')({
	head: () => ({
		meta: [titleMeta(['Account'])],
	}),
	component: AccountIndexRoute,
});

function AccountIndexRoute() {
	return <Navigate to='/account/profile' />;
}
