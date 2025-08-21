import { createFileRoute, Outlet } from '@tanstack/react-router';

// const checkTeamExists = async (slug: string) => {
// 	return slug === 'acme';
// };

export const Route = createFileRoute('/_default')({
	beforeLoad: async () => {},
	component: RouteComponent,
	loader: async ({ context }) => {
		return { user: context.user, isAdmin: context.user?.globalRole === 'admin' };
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
