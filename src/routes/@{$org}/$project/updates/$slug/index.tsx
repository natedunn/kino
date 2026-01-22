import { convexQuery } from '@convex-dev/react-query';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { Calendar, Edit, Link as LinkIcon } from 'lucide-react';

import { api } from '~api';
import { EditorContentDisplay, EditorRefProvider } from '@/components/editor';
import { SidebarSection } from '@/components/sidebar-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusIcon } from '@/icons';
import { useSidebarState } from '@/lib/hooks/use-sidebar-state';
import { formatFullDate, formatRelativeDay } from '@/lib/utils/format-timestamp';

import { UpdateCommentForm } from '../-components/update-comment-form';
import { UpdateCommentsList } from '../-components/update-comments-list';
import { UpdateEmotes } from '../-components/update-emotes';

const SIDEBAR_STORAGE_KEY = 'update-detail-sidebar-state';

type SidebarSections = {
	related: boolean;
};

const DEFAULT_SIDEBAR_STATE: SidebarSections = {
	related: true,
};

export const Route = createFileRoute('/@{$org}/$project/updates/$slug/')({
	loader: async ({ context, params }) => {
		const project = await context.queryClient.ensureQueryData(
			convexQuery(api.project.getDetails, {
				orgSlug: params.org,
				slug: params.project,
			})
		);

		if (!project?.project?._id) {
			throw notFound();
		}

		const updateData = await context.queryClient.ensureQueryData(
			convexQuery(api.update.getBySlug, {
				projectId: project.project._id,
				slug: params.slug,
			})
		);

		if (!updateData) {
			throw notFound();
		}

		return { updateData };
	},
	component: RouteComponent,
});

function RouteComponent() {
	const params = Route.useParams();
	const { updateData: loaderData } = Route.useLoaderData();
	const { state: sidebarState, setSection: setSidebarSection } = useSidebarState(
		SIDEBAR_STORAGE_KEY,
		DEFAULT_SIDEBAR_STATE
	);

	const { data: projectData } = useSuspenseQuery(
		convexQuery(api.project.getDetails, {
			orgSlug: params.org,
			slug: params.project,
		})
	);

	const { data: updateData } = useSuspenseQuery(
		convexQuery(api.update.getBySlug, {
			projectId: projectData?.project?._id!,
			slug: params.slug,
		})
	);

	// Get current user's profile
	const { data: currentProfile } = useQuery(convexQuery(api.profile.findMyProfile, {}));

	const data = updateData ?? loaderData;

	if (!data) {
		return <div className='container py-10'>Update not found.</div>;
	}

	const { update, coverImageUrl, author, relatedFeedback, emoteCounts, canEdit } = data;
	const isAuthenticated = !!currentProfile;
	const hasRelatedFeedback = relatedFeedback && relatedFeedback.length > 0;

	return (
		<div>
			<header>
				<div className='w-full border-b bg-muted/50'>
					<div className='container pt-16 pb-6'>
						<div className='flex items-start justify-between gap-4'>
							<div className='flex flex-col gap-2'>
								<div className='flex items-center gap-2'>
									{update.status === 'draft' && (
										<Badge variant='outline' className='text-yellow-600 dark:text-yellow-400'>
											Draft
										</Badge>
									)}
									{update.tags?.map((tag) => (
										<Badge key={tag} variant='secondary'>
											{tag}
										</Badge>
									))}
								</div>
								<h1 className='text-3xl font-bold'>{update.title}</h1>
								<div className='flex items-center gap-3 text-sm text-muted-foreground'>
									{author && (
										<Link
											to='/@{$org}'
											params={{ org: author.username }}
											className='flex items-center gap-2 hover:underline'
										>
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
										</Link>
									)}
									{update.publishedAt && (
										<Tooltip>
											<TooltipTrigger asChild delay={100}>
												<span className='flex cursor-pointer items-center gap-1'>
													<Calendar className='h-4 w-4' />
													<span suppressHydrationWarning>
														{formatRelativeDay(update.publishedAt)}
													</span>
												</span>
											</TooltipTrigger>
											<TooltipContent>
												<span suppressHydrationWarning>{formatFullDate(update.publishedAt)}</span>
											</TooltipContent>
										</Tooltip>
									)}
								</div>
							</div>
							{canEdit && (
								<Button variant='outline' asChild>
									<Link
										to='/@{$org}/$project/updates/$slug/edit'
										params={{
											org: params.org,
											project: params.project,
											slug: params.slug,
										}}
									>
										<Edit className='h-4 w-4' />
										Edit
									</Link>
								</Button>
							)}
						</div>
					</div>
				</div>
			</header>
			<div className='relative'>
				<div className='absolute h-64 w-full bg-linear-to-t from-background to-muted/50'></div>
				<div className='relative z-10 container py-10'>
					<div className='flex flex-col gap-10 md:grid md:grid-cols-12'>
						{/* Sidebar - Related Feedback */}
						{hasRelatedFeedback && (
							<div className='order-first md:order-last md:col-span-4'>
								<div className='sticky top-4 flex flex-col gap-6'>
									<SidebarSection
										title='Related Feedback'
										icon={<LinkIcon className='size-3.5' />}
										open={sidebarState.related}
										onOpenChange={(open) => setSidebarSection('related', open)}
									>
										<div className='flex flex-col'>
											{relatedFeedback
												?.filter((item): item is NonNullable<typeof item> => item !== null)
												.map((item) => (
													<Link
														key={item._id}
														to='/@{$org}/$project/feedback/$slug'
														params={{
															org: params.org,
															project: params.project,
															slug: item.slug,
														}}
														className='flex cursor-pointer items-center gap-2.5 rounded-md py-2 transition-colors hover:bg-muted/50'
													>
														<StatusIcon status={item.status} size='14' colored />
														<span className='flex-1 truncate text-sm'>{item.title}</span>
													</Link>
												))}
										</div>
									</SidebarSection>
								</div>
							</div>
						)}

						{/* Main content */}
						<div className={hasRelatedFeedback ? 'md:col-span-8' : 'md:col-span-12'}>
							{/* Cover image */}
							{coverImageUrl ? (
								<img
									src={coverImageUrl}
									alt={update.title}
									className='mb-8 w-full rounded-lg bg-muted object-cover'
								/>
							) : (
								<div className='mb-8 flex h-64 w-full items-center justify-center rounded-lg bg-muted text-muted-foreground'>
									Cover Image
								</div>
							)}

							{/* Update content */}
							<EditorContentDisplay content={update.content} className='prose-lg' />

							{/* Emotes */}
							<div className='mt-8 border-t pt-6'>
								<UpdateEmotes
									updateId={update._id}
									emoteCounts={emoteCounts}
									currentProfileId={currentProfile?._id}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Comments section - full width with border */}
			<div className='border-t'>
				<div className='container py-10'>
					<div className={hasRelatedFeedback ? 'md:max-w-[66.666%]' : ''}>
						<EditorRefProvider>
							<h3 className='mb-4 text-lg font-semibold'>Comments</h3>
							<UpdateCommentsList updateId={update._id} currentProfileId={currentProfile?._id} />
							<UpdateCommentForm
								updateId={update._id}
								orgSlug={params.org}
								projectSlug={params.project}
								updateSlug={params.slug}
								isAuthenticated={isAuthenticated}
							/>
						</EditorRefProvider>
					</div>
				</div>
			</div>
		</div>
	);
}
