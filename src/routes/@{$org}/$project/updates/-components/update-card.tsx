import { Calendar, MessageCircle } from 'lucide-react';

import { API } from '~api';
import { ClickableContainer } from '@/components/clickable-container';
import { EmoteContent, EMOTE_EMOJI } from '@/components/emote';
import { Badge } from '@/components/ui/badge';
import { formatRelativeDay } from '@/lib/utils/format-timestamp';
import { truncateToNearestSpace } from '@/lib/utils/truncate';

// Extract the non-empty return type which has 'updates' property
type ListByProjectResult = Exclude<API['update']['listByProject'], never[]>;
type SingleUpdate = ListByProjectResult['updates'][number];

export const UpdateCard = ({
	onNavigationClick,
	update,
}: {
	onNavigationClick: () => void;
	update: SingleUpdate;
}) => {
	const { title, content, author, tags, status, publishedAt, emoteCounts, commentCount, coverImageId } = update;

	// Get list of emotes with counts > 0
	const emoteEntries = Object.entries(emoteCounts || {}) as [
		EmoteContent,
		{ count: number; authorProfileIds: string[] },
	][];

	// Strip HTML tags and get plain text for excerpt
	const plainText = content.replace(/<[^>]*>/g, '');
	const excerpt = truncateToNearestSpace(plainText, 200);

	return (
		<li className='flex overflow-hidden rounded-lg border'>
			<ClickableContainer
				onClick={() => onNavigationClick?.()}
				className='group flex w-full flex-col transition-colors duration-100 ease-in-out hocus:bg-muted/50 hocus:outline-primary'
			>
				{coverImageId && (
					<div className='h-48 w-full overflow-hidden border-b bg-muted'>
						{/* Cover image would be loaded via R2 */}
						<div className='flex h-full items-center justify-center text-muted-foreground'>
							Cover Image
						</div>
					</div>
				)}
				<div className='flex flex-col gap-3 p-5'>
					<div className='flex items-center gap-2'>
						{status === 'draft' && (
							<Badge variant='outline' className='text-yellow-600 dark:text-yellow-400'>
								Draft
							</Badge>
						)}
						{tags?.map((tag: string) => (
							<Badge key={tag} variant='secondary'>
								{tag}
							</Badge>
						))}
					</div>
					<div>
						<h3 className='text-xl font-semibold underline-offset-2 group-hover:underline'>
							{title}
						</h3>
						<p className='mt-2 text-muted-foreground'>{excerpt}</p>
					</div>
					<div className='mt-2 flex items-center justify-between'>
						<div className='flex items-center gap-3 text-sm text-muted-foreground'>
							{author && (
								<div className='flex items-center gap-2'>
									{author.imageUrl ? (
										<img
											className='h-5 w-5 rounded-full'
											src={author.imageUrl}
											alt={author.username}
										/>
									) : (
										<div className='flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground'>
											{author.name?.charAt(0) ?? '?'}
										</div>
									)}
									<span>@{author.username}</span>
								</div>
							)}
							{publishedAt && (
								<div className='flex items-center gap-1'>
									<Calendar className='h-4 w-4' />
									<span suppressHydrationWarning>{formatRelativeDay(publishedAt)}</span>
								</div>
							)}
							{commentCount > 0 && (
								<div className='flex items-center gap-1'>
									<MessageCircle className='h-4 w-4' />
									<span>{commentCount}</span>
								</div>
							)}
						</div>
						{emoteEntries.length > 0 && (
							<div className='flex items-center gap-1'>
								{emoteEntries.map(([emoteType, data]) => (
									<span
										key={emoteType}
										className='flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-sm'
									>
										<span>{EMOTE_EMOJI[emoteType]}</span>
										<span>{data.count}</span>
									</span>
								))}
							</div>
						)}
					</div>
				</div>
			</ClickableContainer>
		</li>
	);
};
