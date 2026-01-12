import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { Authenticated, AuthLoading } from 'convex/react';

export const Route = createFileRoute('/create')({
	component: RouteComponent,
	loader: async ({ context }) => {
		if (!context.userId) {
			throw redirect({
				to: '/sign-in',
			})
		}
	},
});

function RouteComponent() {
	return (
		<>
			<AuthLoading>
				<div className='relative flex h-screen w-full items-center justify-center'>
					<div className='absolute top-0 right-0 left-0 z-0 h-64 w-full bg-gradient-to-t from-background to-muted'></div>
					<svg
						className='mr-3 -ml-1 size-16 animate-spin text-white'
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
					>
						<circle
							className='opacity-25'
							cx='12'
							cy='12'
							r='10'
							stroke='currentColor'
							strokeWidth='4'
						></circle>
						<path
							className='opacity-75'
							fill='currentColor'
							d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
						></path>
					</svg>
				</div>
			</AuthLoading>
			<Authenticated>
				<Outlet />
			</Authenticated>
		</>
	)
}
