import { Link } from '@tanstack/react-router';
import { ClassValue } from 'clsx';
import { ChevronLeft, Home } from 'lucide-react';

import { cn } from '@/lib/utils';

import { buttonVariants } from './ui/button';

export function NotFound({
	className,
	isContainer,
}: {
	className?: ClassValue;
	isContainer?: boolean;
}) {
	return (
		<div className={cn(isContainer && 'container')}>
			<div className={cn('space-y-2', isContainer && 'py-8', className)}>
				<div>
					<h1 className='text-gradient-primary text-4xl font-bold'>404</h1>
					<h2 className='text-2xl font-bold text-muted-foreground'>
						The page you are looking for does not exist.
					</h2>
				</div>
				<p className='mt-8 flex flex-wrap items-center gap-2'>
					<button
						onClick={() => window.history.back()}
						className={buttonVariants({
							variant: 'outline',
						})}
					>
						<ChevronLeft size={16} />
						Back
					</button>
					<Link
						to='/'
						className={buttonVariants({
							variant: 'default',
						})}
					>
						<Home size={16} />
						Home
					</Link>
				</p>
			</div>
		</div>
	);
}
