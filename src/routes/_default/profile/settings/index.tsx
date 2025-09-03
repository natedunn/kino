import { createFileRoute, redirect } from '@tanstack/react-router';
import { useConvexAuth } from 'convex/react';

import { useAuth } from '@/lib/auth/use-auth';

import { UserEditForm } from './-components/user-edit-form';

export const Route = createFileRoute('/_default/profile/settings/')({
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
	const { user } = useAuth({
		userId: Route.useRouteContext().userId,
	});

	if (!user) return null;

	return (
		<div className='flex flex-1 flex-col'>
			<div className='container py-12'>
				<h1 className='text-2xl font-bold'>Edit profile</h1>
				<div className='mt-6'>
					<UserEditForm user={user} />
				</div>
			</div>
		</div>
	);
}
