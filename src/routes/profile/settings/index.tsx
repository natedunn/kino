import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';

import { api } from '~api';

import { UserEditForm } from './-components/user-edit-form';

export const Route = createFileRoute('/profile/settings/')({
	component: RouteComponent,
	loader: async ({ context }) => {
		if (!context.userId) {
			throw redirect({
				to: '/sign-in',
			});
		}
	},
});

function RouteComponent() {
	const { data: profile } = useSuspenseQuery(convexQuery(api.profile.getCurrentProfileUser, {}));

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
