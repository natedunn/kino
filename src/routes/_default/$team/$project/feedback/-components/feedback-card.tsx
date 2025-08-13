import { ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';

export const FeedbackCard = () => {
	return (
		<li className='flex border'>
			<div className='border-r bg-muted p-4'>
				<Button
					variant='outline'
					size='sm'
					className='h-auto flex-col !bg-background py-2 select-none'
				>
					<ChevronUp size={20} />
					123
				</Button>
			</div>
			<a
				href='#'
				className='group flex flex-col p-4 transition-colors duration-100 ease-in-out focus:outline-primary dark:hover:bg-accent/25 hocus:bg-accent/50'
			>
				<span className='text-xl font-medium underline-offset-2 group-focus:underline'>
					Link to resources pages is broken
				</span>
				<div className='mt-2 space-y-4 text-sm text-foreground/75'>
					<p>
						Anim aliquip irure laborum sit Lorem labore deserunt deserunt laboris ea ex exercitation
						ea. Ea mollit ex eu. Aute exercitation duis occaecat officia reprehenderit consequat
						ullamco. Consectetur laborum non veniam et culpa id adipisicing.
					</p>
					<p>
						Est sint ullamco irure esse qui sunt et adipisicing veniam sint ad. Ea sint ullamco.
					</p>
				</div>
				<div className='mt-8'>
					<div>
						Filed in <span className='font-medium text-primary'>Bugs</span>
					</div>
				</div>
			</a>
		</li>
	);
};
