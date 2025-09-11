import { convexQuery } from '@convex-dev/react-query';
import { ClientOnly, createFileRoute, Link, notFound, Outlet } from '@tanstack/react-router';

import { api } from '~api';
import { NotFound } from '@/components/_not-found';

import { MainNav } from '../-components/main-nav';

export const Route = createFileRoute('/@{$org}')({
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
		<div className='flex flex-1 flex-col'>
			<Link to='/@{$org}' params={{ org: 'natedunn' }}>
				Go to natedunn
			</Link>
			{/* <ClientOnly fallback={<div>Loading...</div>}>
				<MainNav />
			</ClientOnly> */}
			<Outlet />
		</div>
	);
}
