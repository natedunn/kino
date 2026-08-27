import { useQuery } from '@tanstack/react-query';

import { useCRPC } from '@/lib/convex/crpc';

import { MainNav } from './main-nav';

export function PublicMainNav() {
	const crpc = useCRPC();
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
