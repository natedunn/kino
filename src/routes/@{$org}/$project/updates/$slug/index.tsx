import { convexQuery } from '@convex-dev/react-query';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { Calendar, Edit, Pencil, Users } from 'lucide-react';

import { api } from '~api';
import { EditorContentDisplay, EditorRefProvider } from '@/components/editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatFullDate, formatRelativeDay } from '@/lib/utils/format-timestamp';

import { RelatedFeedback } from '../-components/related-feedback';
import { UpdateCommentForm } from '../-components/update-comment-form';
import { UpdateCommentsList } from '../-components/update-comments-list';
import { UpdateEmotes } from '../-components/update-emotes';

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

	const { update, author, relatedFeedback, emoteCounts, canEdit } = data;
	const isAuthenticated = !!currentProfile;

	return (
		<div>
			<header>
				<div className='w-full border-b bg-muted/50'>
					<div className='container px-8 pt-16 pb-6'>
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
												<span className='flex items-center gap-1 cursor-pointer'>
													<Calendar className='h-4 w-4' />
													<span suppressHydrationWarning>
														{formatRelativeDay(update.publishedAt)}
													</span>
												</span>
											</TooltipTrigger>
											<TooltipContent>
												<span suppressHydrationWarning>
													{formatFullDate(update.publishedAt)}
												</span>
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
					<div className='mx-auto max-w-3xl'>
						{/* Update content */}
						<div className='rounded-lg border bg-background p-8'>
							<EditorContentDisplay content={update.content} />

							{/* Emotes */}
							<div className='mt-8 border-t pt-6'>
								<UpdateEmotes
									updateId={update._id}
									emoteCounts={emoteCounts}
									currentProfileId={currentProfile?._id}
								/>
							</div>
						</div>

						{/* Related feedback */}
						{relatedFeedback && relatedFeedback.length > 0 && (
							<RelatedFeedback
								orgSlug={params.org}
								projectSlug={params.project}
								feedback={relatedFeedback as any}
							/>
						)}

						{/* Comments section */}
						<EditorRefProvider>
							<div className='mt-8'>
								<h3 className='mb-4 text-lg font-semibold'>Comments</h3>
								<UpdateCommentsList
									updateId={update._id}
									currentProfileId={currentProfile?._id}
								/>
								<UpdateCommentForm
									updateId={update._id}
									orgSlug={params.org}
									projectSlug={params.project}
									updateSlug={params.slug}
									isAuthenticated={isAuthenticated}
								/>
							</div>
						</EditorRefProvider>
					</div>
				</div>
			</div>
		</div>
	);
}
