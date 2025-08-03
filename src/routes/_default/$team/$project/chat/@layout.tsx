import { createFileRoute, Outlet } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';

export const Route = createFileRoute('/_default/$team/$project/chat')({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className='flex flex-1'>
			{/* Chats */}
			<div className='w-[16rem] border-r'>
				<div className='flex h-14 items-center border-b bg-muted/50 px-6 text-sm'>Channels</div>
				<div>
					<div className='flex items-center justify-between gap-2 border-b p-5'>
						<div className='flex items-center gap-2'>
							<div className='flex size-7 items-center bg-muted px-2 py-1.5 text-sm'>✨</div>
							<span>General</span>
						</div>
						<div>
							<ChevronRight />
						</div>
					</div>
					<div className='flex items-center justify-between gap-2 border-b p-5'>
						<div className='flex items-center gap-2'>
							<div className='flex size-7 items-center justify-center bg-destructive px-2 py-1.5 text-sm text-destructive-foreground'>
								1
							</div>
							<span>Stack</span>
						</div>
						<div>
							<ChevronRight />
						</div>
					</div>
					<div className='flex items-center justify-between gap-2 border-b p-5'>
						<div className='flex items-center gap-2'>
							<div className='flex size-7 items-center bg-muted px-2 py-1.5 text-sm'>👀</div>
							<span>Off-topic</span>
						</div>
						<div>
							<ChevronRight />
						</div>
					</div>
				</div>
			</div>
			{/* Messages */}
			<div className='flex flex-1 flex-col items-stretch'>
				<Outlet />
			</div>
		</div>
	);
}
