import { API } from '~api';
import { ClickableContainer } from '@/components/clickable-container';
import { Button } from '@/components/ui/button';
import { StatusIcon } from '@/icons';
import ChevronUp from '@/icons/chevron-up';
import CircleDot from '@/icons/circle-dot';
import { ArrayType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { truncateToNearestSpace } from '@/lib/utils/truncate';

type SingleFeedback = NonNullable<
	ArrayType<NonNullable<API['feedback']['listProjectFeedback']>['page']>
>;

export const FeedbackCard = ({
	onNavigationClick,
	feedback,
}: {
	onNavigationClick: () => void;
	feedback: SingleFeedback;
}) => {
	const { title, firstComment, upvotes, board, status } = feedback;

	return (
		<li className='flex overflow-hidden rounded-lg border'>
			<div className='border-r bg-muted px-4 pt-4'>
				<Button
					variant='outline'
					size='sm'
					className={cn(
						'h-auto w-12 flex-col bg-background! py-2 font-bold select-none hocus:bg-primary! hocus:text-background! dark:hocus:text-foreground!',
						upvotes > 9999 ? 'text-xs' : upvotes > 999 ? 'text-sm' : 'text-base'
					)}
				>
					<ChevronUp size='20' />
					{upvotes}
				</Button>
			</div>
			<ClickableContainer
				onClick={() => onNavigationClick?.()}
				className='group flex w-full flex-col p-5 transition-colors duration-100 ease-in-out hocus:bg-muted/50 hocus:outline-primary'
			>
				<div className='flex items-start gap-4'>
					<div className='mt-1'>
						{/* <CircleDot className='text-blue-300' size='30px' /> */}
						<StatusIcon status={status} size='30px' colored />
					</div>
					<div className=''>
						<span className='text-xl font-medium underline-offset-2 group-hover:underline'>
							{title}
						</span>
						<div className='mt-2 h-full max-h-[250px] space-y-4 overflow-hidden text-ellipsis text-muted-foreground'>
							{truncateToNearestSpace(firstComment?.content ?? '', 300)}
						</div>
						{board && (
							<div className='mt-8 text-sm text-muted-foreground'>
								Filed in <span className='underline'>{board.name}</span>
							</div>
						)}
					</div>
				</div>
			</ClickableContainer>
		</li>
	);
};
