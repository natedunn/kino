import { Link } from '@tanstack/react-router';

import { API } from '~api';
import { StatusIcon } from '@/icons';
import { ArrayType } from '@/lib/types';

type RelatedFeedbackItem = ArrayType<
	NonNullable<NonNullable<API['update']['getBySlug']>['relatedFeedback']>
>;

type RelatedFeedbackProps = {
	orgSlug: string;
	projectSlug: string;
	feedback: RelatedFeedbackItem[];
};

export function RelatedFeedback({ orgSlug, projectSlug, feedback }: RelatedFeedbackProps) {
	// Filter out null items
	const validFeedback = feedback.filter((item): item is NonNullable<typeof item> => item !== null);

	if (validFeedback.length === 0) {
		return null;
	}

	return (
		<div className='mt-8 rounded-lg border p-6'>
			<h3 className='mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase'>
				Related Feedback
			</h3>
			<ul className='space-y-3'>
				{validFeedback.map((item) => (
					<li key={item._id}>
						<Link
							to='/@{$org}/$project/feedback/$slug'
							params={{
								org: orgSlug,
								project: projectSlug,
								slug: item.slug,
							}}
							className='flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50'
						>
							<StatusIcon status={item.status} size='16' colored />
							<span className='flex-1 text-sm'>{item.title}</span>
							{item.board && (
								<span className='text-xs text-muted-foreground'>{item.board.name}</span>
							)}
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}
