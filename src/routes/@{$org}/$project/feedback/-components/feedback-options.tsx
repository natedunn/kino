import { Link, useParams } from '@tanstack/react-router';
import { SquareArrowOutUpRight } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';

export const FeedbackOptions = () => {
	const { org, project } = useParams({
		from: '/@{$org}/$project/feedback/',
	});
	return (
		<div className='flex flex-col gap-2'>
			<Link
				className={buttonVariants({
					variant: 'outline',
					className: 'group inline-flex! w-full items-center justify-between! text-left',
				})}
				to='/@{$org}/$project/feedback/boards'
				params={{
					org,
					project,
				}}
			>
				<span>All boards</span>
				<SquareArrowOutUpRight className='size-4 text-muted-foreground' />
			</Link>
		</div>
	);
};
