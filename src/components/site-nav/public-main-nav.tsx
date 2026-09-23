import { useQuery } from '@tanstack/react-query';

import { useProfileAPI } from '@/lib/convex/profile-api';

import { MainNav } from './main-nav';

export function PublicMainNav() {
	const crpc = useProfileAPI();
	const currentViewerQuery = useQuery(
		crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
	);

	return (
		<MainNav
			context={{ type: 'global' }}
			isUserPending={currentViewerQuery.isLoading}
			user={currentViewerQuery.data}
		/>
	);
}
