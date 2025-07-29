import { Link } from '@tanstack/react-router';
import { ChevronLeft, Home } from 'lucide-react';

import { buttonVariants } from './ui/button';

export function NotFound() {
	return (
		<div className='space-y-2 p-8'>
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
	);
}
