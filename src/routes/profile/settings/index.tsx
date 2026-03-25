import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Navigate, useRouterState } from '@tanstack/react-router';
import { useConvexAuth } from 'convex/react';

import { api } from '~api';

import { UserEditForm } from './-components/user-edit-form';

export const Route = createFileRoute('/profile/settings/')({
	component: RouteComponent,
});

function RouteComponent() {
	const { isAuthenticated, isLoading } = useConvexAuth();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	if (isLoading) {
		return null;
	}

	if (!isAuthenticated) {
		return <Navigate to='/sign-in' search={{ redirect: pathname }} />;
	}

	const { data: profile } = useSuspenseQuery(convexQuery(api.profile.findMyProfile, {}));

	if (!profile) return null;

	return (
		<div className='flex flex-1 flex-col'>
			<div className='container py-12'>
				<h1 className='text-2xl font-bold'>Edit profile</h1>
				<div className='mt-6'>
					<UserEditForm profile={profile} />
				</div>
			</div>
		</div>
	);
}
