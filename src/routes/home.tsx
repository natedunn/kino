import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Navigate, useRouterState } from '@tanstack/react-router';
import { useConvexAuth } from 'convex/react';

import { api } from '~api';
import { authClient } from '@/lib/auth/auth-client';

export const Route = createFileRoute('/home')({
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

	const { data: user } = useSuspenseQuery(convexQuery(api.profile.findMyProfile, {}));

	const { data: orgs } = authClient.useListOrganizations();

	return (
		<div>
			<h1>Hello, {user?.name}</h1>
			<div>Below are a list of teams you are a part of.</div>
			{!orgs ? (
				<div>No orgs found.</div>
			) : (
				orgs?.map((org) => {
					return (
						<div key={org.id}>
							<span>{org.name}</span>
						</div>
					);
				})
			)}
		</div>
	);
}
