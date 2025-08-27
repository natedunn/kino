import { useRouter } from '@tanstack/react-router';
import { ChevronUp } from 'lucide-react';

import { ClickableContainer } from '@/components/ clickable-container';
import { Button } from '@/components/ui/button';

export const FeedbackCard = ({
	orgSlug,
	projectSlug,
}: {
	orgSlug: string;
	projectSlug: string;
}) => {
	const router = useRouter();

	return (
		<li className='flex overflow-hidden rounded-lg border'>
			<div className='border-r bg-muted p-4'>
				<Button
					variant='outline'
					size='sm'
					className='h-auto flex-col !bg-background py-2 select-none hocus:!bg-primary hocus:!text-background dark:hocus:!text-foreground'
				>
					<ChevronUp size={20} />
					123
				</Button>
			</div>
			<ClickableContainer
				onClick={() => {
					router.navigate({
						to: '/$org/$project/feedback/$feedbackId',
						params: {
							org: orgSlug,
							project: projectSlug,
							feedbackId: '123',
						},
					});
				}}
				className='group flex flex-col p-4 transition-colors duration-100 ease-in-out hocus:bg-muted/50 hocus:outline-primary'
			>
				<span className='text-xl font-medium underline-offset-2 group-hocus:underline'>
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
			</ClickableContainer>
		</li>
	);
};
