import type { Id } from '../../../../../../convex/native/_generated/dataModel';
import type { UpdateCategory } from './category-badge';

import { Link } from '@tanstack/react-router';

import { NativeFileImage } from '@/components/files/native-files';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatFullDate } from '@/lib/utils/format-timestamp';
import * as m from '@/paraglide/messages.js';

import { CategoryBadge } from './category-badge';

const HERO_EXCERPT_CHARS = 220;

export type FeaturedUpdateItem = {
	author: { id: string; imageUrl?: string | null; name: string; username: string } | null;
	category: UpdateCategory;
	contentPreview?: string;
	coverImageUrl?: string | null;
	coverAssetId?: Id<'fileAssets'>;
	id: string;
	publishedAt?: number | null;
	slug: string;
	title: string;
};

// Placeholder cover for featured updates without an uploaded image. Kept
// intentionally simple for now — richer randomized artwork can replace this.
function CoverImage({ className, update }: { className?: string; update: FeaturedUpdateItem }) {
	if (update.coverAssetId)
		return (
			<NativeFileImage
				assetId={update.coverAssetId}
				className={cn('h-full w-full object-cover', className)}
			/>
		);
	if (update.coverImageUrl) {
		return (
			<img
				alt=''
				className={cn('h-full w-full object-cover', className)}
				src={update.coverImageUrl}
			/>
		);
	}

	return (
		<div
			aria-hidden='true'
			className={cn(
				'flex h-full w-full items-center justify-center bg-linear-to-br from-primary/20 via-primary/5 to-muted',
				className
			)}
		>
			<span className='text-5xl font-bold text-primary/30 select-none'>
				{update.title.trim().charAt(0).toUpperCase()}
			</span>
		</div>
	);
}

function FeaturedAvatar({
	author,
	size = 'sm',
}: {
	author: FeaturedUpdateItem['author'];
	size?: 'md' | 'sm';
}) {
	if (!author) return null;

	return (
		<Avatar
			className={cn('shrink-0', size === 'md' ? 'size-6' : 'size-5')}
			fallbackName={author.username}
			title={author.name}
		>
			<AvatarImage alt={author.name} src={author.imageUrl ?? undefined} />
			<AvatarFallback />
		</Avatar>
	);
}

function heroExcerpt(item: FeaturedUpdateItem): string {
	const source = (item.contentPreview ?? '').trim();
	if (source.length <= HERO_EXCERPT_CHARS) return source;
	return `${source.slice(0, HERO_EXCERPT_CHARS).trimEnd()}…`;
}

export function FeaturedUpdatesSection({
	items,
	orgSlug,
	projectSlug,
}: {
	items: Array<FeaturedUpdateItem>;
	orgSlug: string;
	projectSlug: string;
}) {
	const hero = items.at(0);
	if (!hero) return null;

	const secondary = items.slice(1);
	const excerpt = heroExcerpt(hero);

	return (
		<section
			aria-label={m.updates_featured_section()}
			className='flex w-full min-w-0 flex-col gap-6'
		>
			<Link
				className='group grid min-w-0 items-center gap-6 rounded-xl border bg-foreground/4 p-4 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/80 md:grid-cols-2 md:gap-10 md:p-6 dark:bg-muted/30 hocus:bg-foreground/6 dark:hocus:bg-muted/50'
				params={{ org: orgSlug, project: projectSlug, slug: hero.slug }}
				to='/@{$org}/$project/updates/$slug'
			>
				<div className='aspect-video w-full overflow-hidden rounded-xl border bg-muted'>
					<CoverImage update={hero} />
				</div>
				<div className='flex min-w-0 flex-col gap-4'>
					<h2 className='link-text min-w-0 text-2xl leading-tight font-bold break-words md:text-3xl'>
						{hero.title}
					</h2>
					{excerpt ? (
						<p className='line-clamp-3 min-w-0 break-words text-muted-foreground'>{excerpt}</p>
					) : null}
					<div className='flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-6'>
						<FeaturedAvatar author={hero.author} size='md' />
						<div className='flex min-w-0 items-center gap-2.5'>
							<CategoryBadge category={hero.category} />
							{hero.publishedAt ? (
								<span
									className='shrink-0 text-sm whitespace-nowrap text-muted-foreground'
									suppressHydrationWarning
								>
									{formatFullDate(hero.publishedAt)}
								</span>
							) : null}
						</div>
					</div>
				</div>
			</Link>

			{secondary.length > 0 ? (
				<div className='grid gap-6 sm:grid-cols-2'>
					{secondary.map((item) => (
						<Link
							className='group flex min-w-0 items-center gap-4 rounded-lg border bg-foreground/4 p-4 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/80 sm:gap-5 sm:p-5 dark:bg-muted/30 hocus:bg-foreground/6 dark:hocus:bg-muted/50'
							key={item.id}
							params={{ org: orgSlug, project: projectSlug, slug: item.slug }}
							to='/@{$org}/$project/updates/$slug'
						>
							<div className='aspect-video w-32 shrink-0 overflow-hidden rounded-lg border bg-muted sm:w-36'>
								<CoverImage className='[&>span]:text-2xl' update={item} />
							</div>
							<div className='flex min-w-0 flex-col gap-3'>
								<h3 className='link-text line-clamp-2 min-w-0 leading-snug font-medium break-words'>
									{item.title}
								</h3>
								<div className='flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5'>
									<FeaturedAvatar author={item.author} />
									<CategoryBadge category={item.category} />
									{item.publishedAt ? (
										<span
											className='text-xs whitespace-nowrap text-muted-foreground'
											suppressHydrationWarning
										>
											{formatFullDate(item.publishedAt)}
										</span>
									) : null}
								</div>
							</div>
						</Link>
					))}
				</div>
			) : null}
		</section>
	);
}
