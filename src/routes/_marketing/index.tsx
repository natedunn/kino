import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_marketing/')({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className='flex h-screen w-full items-center justify-center'>
			<div className='relative'>
				<h1 className='relative z-10 text-gradient-primary text-8xl font-bold'>KINO</h1>
				<h1 className='absolute top-10 scale-250 text-3xl font-bold opacity-100 blur-xl select-none'>
					KINO
				</h1>
			</div>
		</div>
	);
}
