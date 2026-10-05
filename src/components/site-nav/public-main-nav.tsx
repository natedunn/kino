import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';

import { useAuthState } from '@/lib/auth/auth-client';
import { deriveViewerSignedIn } from '@/lib/auth/auth-snapshot';

import { api } from '../../../convex/native/_generated/api';
import { MainNav } from './main-nav';

const rootRoute = getRouteApi('__root__');

export function PublicMainNav() {
	const auth = useAuthState();
	const { loaderToken } = rootRoute.useLoaderData();
	// Signed-out visitors render "Sign in" in the first HTML without a Convex
	// round-trip; signed-in visitors read the profile the root `beforeLoad`
	// prefetched during SSR.
	const signedIn = deriveViewerSignedIn(auth, !!loaderToken);
	const viewerQuery = useQuery(convexQuery(api.profiles.me, signedIn ? {} : 'skip'));

	return (
		<MainNav
			context={{ type: 'global' }}
			isUserPending={signedIn && viewerQuery.data === undefined}
			user={signedIn ? viewerQuery.data : null}
		/>
	);
}
