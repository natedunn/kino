import { convexQuery } from '@convex-dev/react-query';
import { createFileRoute, Outlet } from '@tanstack/react-router';

import { api } from '~api';
import { Id } from '@/convex/_generated/dataModel';

export const Route = createFileRoute('/_default')({
	component: RouteComponent,
	loader: async ({ context }) => {
		if (context.user?._id) {
			await context.queryClient.ensureQueryData(
				convexQuery(api.user.get, {
					_id: context.user._id as Id<'user'>,
				})
			);
		}

		return { isAdmin: context.user?.globalRole === 'admin' };
	},
});

function RouteComponent() {
	return (
		<div className='flex h-screen w-full flex-col'>
			<div className='flex w-full flex-1'>
				<Outlet />
			</div>
			<footer className='mt-auto w-full border-t border-border py-4 text-center text-sm text-muted-foreground'>
				<div className='container'>
					<p>© {new Date().getFullYear()} Kino</p>
				</div>
			</footer>
		</div>
	);
}
