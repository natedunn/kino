import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
	component: RouteComponent,
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
