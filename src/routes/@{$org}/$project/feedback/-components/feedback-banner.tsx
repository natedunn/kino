import Megaphone from '@/icons/megaphone';

export const FeedbackBanner = () => {
	return (
		<div className='overflow-hidden rounded-lg border border-primary/50 bg-linear-to-tl from-primary/20 to-primary/5 p-8'>
			<div className='flex items-start gap-4'>
				<div className='mt-1'>
					<Megaphone className='size-8 text-primary dark:text-blue-300' aria-hidden='true' />
				</div>
				<div>
					<h2 className='text-2xl font-bold text-primary dark:text-blue-50'>
						We want to hear your feedback
					</h2>
					<p className='text-primary dark:text-blue-300'>
						Make sure to read the feedback rules and guidelines before posting.
					</p>
				</div>
			</div>
		</div>
	);
};
