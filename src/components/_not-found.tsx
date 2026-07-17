import { Link } from '@tanstack/react-router';
import type { ClassValue } from '@/lib/utils';

// import { ChevronLeft, Home } from 'lucide-react';
import ChevronLeft from '@/icons/chevron-left';
import Home from '@/icons/home';
import { cn } from '@/lib/utils';

import { Button, buttonVariants } from './ui/button';

export function NotFound({
	className,
	isContainer,
	message,
}: {
	className?: ClassValue;
	isContainer?: boolean;
	message?: string;
}) {
	return (
		<div className={cn(isContainer && 'container')}>
			<div className={cn('space-y-2', isContainer && 'py-8', className)}>
				<div>
					<h1 className='text-gradient-primary text-5xl font-bold'>404</h1>
					<h2 className='mt-1 text-2xl font-bold text-muted-foreground'>
						{message ?? 'The page you are looking for does not exist.'}
					</h2>
				</div>
				<p className='mt-4 flex flex-wrap items-center gap-2'>
					<Button
						variant='outline'
						onClick={() => window.history.back()}
					>
						<ChevronLeft size='14px' />
						Back
					</Button>
					<Link
						to='/'
						className={buttonVariants({
							variant: 'default',
						})}
					>
						<Home size='14px' />
						Home
					</Link>
				</p>
			</div>
		</div>
	);
}
