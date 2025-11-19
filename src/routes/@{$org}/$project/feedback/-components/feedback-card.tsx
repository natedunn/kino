import { Link } from '@tanstack/react-router';

import { API } from '~api';
import { ClickableContainer } from '@/components/clickable-container';
import { Button } from '@/components/ui/button';
import ChevronUp from '@/icons/chevron-up';
import { ArrayType } from '@/lib/types';

type SingleFeedback = NonNullable<ArrayType<NonNullable<API['features']['feedback']>['feedback']>>;

export const FeedbackCard = ({
	onNavigationClick,
	feedback,
}: {
	onNavigationClick: () => void;
	feedback: SingleFeedback;
}) => {
	const { title, firstComment, upvotes, board } = feedback;
	return (
		<li className='flex overflow-hidden rounded-lg border'>
			<div className='border-r bg-muted px-6 pt-7'>
				<Button
					variant='outline'
					size='sm'
					className='h-auto w-13 flex-col bg-background! py-2 font-bold select-none hocus:bg-primary! hocus:text-background! dark:hocus:text-foreground!'
				>
					<ChevronUp size='20' />
					{upvotes}
				</Button>
			</div>
			<ClickableContainer
				onClick={() => onNavigationClick?.()}
				className='group flex w-full flex-col p-6 transition-colors duration-100 ease-in-out hocus:bg-muted/50 hocus:outline-primary'
			>
				<span className='text-xl font-medium underline-offset-2 group-hover:underline'>
					{title}
				</span>
				<div className='mt-2 space-y-4 text-sm text-muted-foreground'>{firstComment?.content}</div>
				{board && (
					<div className='mt-8 text-sm text-muted-foreground'>
						Filed in <span className='underline'>{board.name}</span>
					</div>
				)}
			</ClickableContainer>
		</li>
	);
};
