import { convexQuery } from '@convex-dev/react-query';
import { createFileRoute, notFound, Outlet } from '@tanstack/react-router';

import { api } from '~api';
import { NotFound } from '@/components/_not-found';

import { MainNav } from './-components/main-nav';

export const Route = createFileRoute('/@{$org}')({
	loader: async ({ context, params }) => {
		const user = await context.queryClient.ensureQueryData(
			convexQuery(api.user.getCurrentUser, {})
		);

		await context.queryClient
			.ensureQueryData(
				convexQuery(api.org.getDetails, {
					slug: params.org,
				})
			)
			.catch((error) => {
				console.log(error);
				throw notFound();
			});

		return {
			user,
		};
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
	const { user } = Route.useLoaderData();
	return (
		<div className='flex h-screen w-full flex-col'>
			<div className='flex w-full flex-1 flex-col'>
				<MainNav user={user} />
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
