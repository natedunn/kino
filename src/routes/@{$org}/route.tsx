import { convexQuery } from '@convex-dev/react-query';
import { createFileRoute, Outlet } from '@tanstack/react-router';

import { api } from '~api';
import { NotFound } from '@/components/_not-found';

import { MainNav } from './-components/main-nav';

export const Route = createFileRoute('/@{$org}')({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(convexQuery(api.user.getCurrentUser, {}));
	},
	notFoundComponent: () => {
		return (
			<div className='container'>
				<NotFound />
			</div>
		);
	},
	pendingComponent: () => {
		return (
			<div className='container'>
				<div className='text-red-500'>PENDING in ORG LAYOUT</div>
			</div>
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className='flex h-screen w-full flex-col'>
			<div className='flex w-full flex-1 flex-col'>
				<MainNav />
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
