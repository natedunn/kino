import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';

import { api } from '~api';
import { authClient } from '@/lib/auth/auth-client';

export const Route = createFileRoute('/home')({
	beforeLoad: async ({ context }) => {
		if (!context.userId) {
			throw redirect({
				to: '/sign-in',
			});
		}
	},
	component: RouteComponent,
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(convexQuery(api.profile.getCurrentProfileUser, {}));
	},
});

function RouteComponent() {
	const { data: user } = useSuspenseQuery(convexQuery(api.profile.getCurrentProfileUser, {}));

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
