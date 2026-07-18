import { Navigate, createFileRoute } from '@tanstack/react-router';

import { titleMeta } from '@/lib/seo';

// The profile settings page moved to the dedicated `/account` area. Keep this
// route as a redirect so existing links and bookmarks continue to work.
export const Route = createFileRoute('/profile/settings/')({
	head: () => ({
		meta: [titleMeta(['Account'])],
	}),
	component: ProfileSettingsRedirect,
});

function ProfileSettingsRedirect() {
	return <Navigate replace to='/account/profile' />;
}
