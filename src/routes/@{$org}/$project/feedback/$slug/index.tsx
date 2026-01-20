import { convexQuery } from '@convex-dev/react-query';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { CircleCheck, CircleDot, CircleDotDashed } from 'lucide-react';

import { api } from '~api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StatusIcon } from '@/icons';
import { cn } from '@/lib/utils';
import { formatTimestamp } from '@/lib/utils/format-timestamp';

import { EditorContentDisplay, EditorRefProvider } from '@/components/editor';
import { AssignedTo } from '../-components/assigned-to';
import { BoardSwitcher } from '../-components/board-switcher';
import { CommentForm } from '../-components/comment-form';
import { CommentsList } from '../-components/comments-list';
import { EmoteButton, EmoteContent, EmotePicker } from '../-components/emote-picker';
import { StatusSwitcher } from '../-components/status-switcher';
import Updates from '../-components/updates';

// Static test slug for comparing with the original placeholder design
const TEST_SLUG = 'TEST';

export const Route = createFileRoute('/@{$org}/$project/feedback/$slug/')({
	loader: async ({ context, params }) => {
		// Skip data fetching for TEST slug - render static placeholder instead
		if (params.slug === TEST_SLUG) {
			return { feedbackData: null, isTestMode: true };
		}

		const project = await context.queryClient.ensureQueryData(
			convexQuery(api.project.getDetails, {
				orgSlug: params.org,
				slug: params.project,
			})
		);

		if (!project?.project?._id) {
			throw notFound();
		}

		const feedbackData = await context.queryClient.ensureQueryData(
			convexQuery(api.feedback.getBySlug, {
				projectId: project.project._id,
				slug: params.slug,
			})
		);

		if (!feedbackData) {
			throw notFound();
		}

		return { feedbackData, isTestMode: false };
	},
	component: RouteComponent,
});

// =============================================================================
// STATIC PLACEHOLDER VERSION (Original design for reference)
// Access via slug "TEST" - e.g., /@org/project/feedback/TEST
// =============================================================================
type PlaceholderStatus = 'open' | 'planned' | 'closed';

const PlaceholderStatusBadge = ({ status }: { status: PlaceholderStatus }) => {
	const statusClass = {
		open: 'bg-green-700/50 text-green-100',
		planned: 'bg-blue-700/50 text-blue-100',
		closed: 'bg-red-700/50 text-red-100',
	};

	return (
		<span className={cn(statusClass[status], 'inline-block px-1.5 py-0.5 text-xs capitalize')}>
			{status}
		</span>
	);
};

function StaticPlaceholder() {
	const feedback = {
		id: 'blah',
		title: 'This is a feature request',
		status: 'open' as PlaceholderStatus,
		upvotes: 0,
		assignedTo: 'natedunn',
		assignedBy: 'davinbuster',
		filedIn: 'features',
	};

	return (
		<div>
			<header className="">
				<div className="w-full border-b bg-muted/50">
					<div className="container flex items-start gap-4 px-8 pt-16 pb-6">
						<div className="mt-1">
							<CircleDot size={28} className="text-primary" />
						</div>
						<div className="flex flex-col gap-2">
							<h1 className="text-3xl">This is a feature request</h1>
							<div className="text-sm text-muted-foreground">
								<span>Open · 12 comments · 45 upvotes · Fresh</span>
							</div>
						</div>
					</div>
				</div>
			</header>
			<div className="relative">
				<div className="absolute h-64 w-full bg-linear-to-t from-background to-muted/50"></div>
				<div className="relative z-10 container py-10">
					<div className="grid gap-10 md:grid-cols-12">
						<div className="order-first md:order-last md:col-span-4">
							<div className="sticky top-4 flex flex-col gap-4">
								{/* Assigned to */}
								<AssignedTo />
								<div className="rounded-lg border bg-muted p-4">
									<ul className="flex w-full flex-col justify-center gap-3">
										<li className="flex w-full justify-between gap-2">
											<span className="text-xs font-semibold tracking-wide uppercase opacity-50">
												Status:
											</span>
											<PlaceholderStatusBadge status={feedback.status} />
										</li>
										<li className="flex w-full items-center justify-between gap-2">
											<span className="text-xs font-semibold tracking-wide uppercase opacity-50">
												Upvotes:
											</span>{' '}
											<span className="rounded bg-accent p-1 text-xs font-semibold tracking-wide uppercase opacity-50">
												{feedback.upvotes}
											</span>
										</li>
										<li className="flex w-full items-center justify-between gap-2">
											<span className="text-xs font-semibold tracking-wide uppercase opacity-50">
												Assigned By:
											</span>{' '}
											<a className="text-sm hocus:underline" href={`/console/p/nothing/u/acme`}>
												{feedback.assignedBy}
											</a>
										</li>
										<li className="flex w-full items-center justify-between gap-2">
											<span className="text-xs font-semibold tracking-wide uppercase opacity-50">
												Board:
											</span>{' '}
											<span className="text-xs font-semibold tracking-wide uppercase opacity-50">
												{feedback.filedIn}
											</span>
										</li>
									</ul>
								</div>
								<div className="flex flex-col gap-2">
									<Button variant="outline" className="gap-2">
										<CircleCheck size={16} />
										Mark as complete
									</Button>
									<Button variant="outline" className="gap-2">
										<CircleDotDashed size={16} />
										Mark as in progress
									</Button>
								</div>
							</div>
						</div>
						<div className="md:col-span-8">
							<Updates />
							<div className="mt-6 flex gap-3 rounded-lg border bg-accent/30 p-4">
								<Textarea rows={1} placeholder="Leave a comment..." />
								<div>
									<Button className="gap-2">Comment</Button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// LIVE DATA VERSION
// =============================================================================
function RouteComponent() {
	const params = Route.useParams();
	const { feedbackData: loaderData, isTestMode } = Route.useLoaderData();

	// Render static placeholder for TEST slug
	if (isTestMode || params.slug === TEST_SLUG) {
		return <StaticPlaceholder />;
	}

	const { data: projectData } = useSuspenseQuery(
		convexQuery(api.project.getDetails, {
			orgSlug: params.org,
			slug: params.project,
		})
	);

	const { data: feedbackData } = useSuspenseQuery(
		convexQuery(api.feedback.getBySlug, {
			projectId: projectData?.project?._id!,
			slug: params.slug,
		})
	);

	// Get current user's profile for highlighting their emotes
	const { data: currentProfile } = useQuery(convexQuery(api.profile.findMyProfile, {}));

	// Get comments with emotes for the first comment
	const { data: comments } = useSuspenseQuery(
		convexQuery(api.feedbackComment.listByFeedback, {
			feedbackId: feedbackData?.feedback._id!,
		})
	);

	const data = feedbackData ?? loaderData;

	if (!data) {
		return <div className="container py-10">Feedback not found.</div>;
	}

	const { feedback, author, board, firstComment } = data;

	// Find the first comment with emotes from the comments list
	const firstCommentWithEmotes = comments?.find((c) => c._id === firstComment?._id);

	// Determine if user can edit status (owner or has project edit permissions)
	const isOwner = currentProfile?._id === feedback.authorProfileId;
	const canEditStatus = isOwner || (projectData?.permissions?.canEdit ?? false);

	return (
		<div>
			<header>
				<div className="w-full border-b bg-muted/50">
					<div className="container flex items-start gap-4 px-8 pt-16 pb-6">
						<div className="mt-1">
							<StatusIcon status={feedback.status} size="28" colored />
						</div>
						<div className="flex flex-col gap-2">
							<h1 className="text-3xl">{feedback.title}</h1>
							<div className="text-sm text-muted-foreground">
								<span>
									{feedback.status === 'open' ? 'Opened' : 'Updated'}{' '}
									{formatTimestamp(feedback._creationTime)} · {feedback.upvotes} upvote
									{feedback.upvotes !== 1 ? 's' : ''}
								</span>
							</div>
						</div>
					</div>
				</div>
			</header>
			<div className="relative">
				<div className="absolute h-64 w-full bg-linear-to-t from-background to-muted/50"></div>
				<div className="relative z-10 container py-10">
					<div className="grid gap-10 md:grid-cols-12">
						<div className="order-first md:order-last md:col-span-4">
							<div className="sticky top-4 flex flex-col gap-4">
								{/* TODO: Future feature - Assigned to
								<AssignedTo />
								*/}
								<div className="rounded-lg border bg-muted p-4">
									<ul className="flex w-full flex-col justify-center gap-3">
										<li className="flex w-full justify-between gap-2">
											<span className="text-xs font-semibold tracking-wide uppercase opacity-50">
												Status:
											</span>
											<StatusSwitcher
												feedbackId={feedback._id}
												currentStatus={feedback.status}
												canEdit={canEditStatus}
											/>
										</li>
										<li className="flex w-full items-center justify-between gap-2">
											<span className="text-xs font-semibold tracking-wide uppercase opacity-50">
												Upvotes:
											</span>{' '}
											<span className="rounded bg-accent p-1 text-xs font-semibold tracking-wide uppercase opacity-50">
												{feedback.upvotes}
											</span>
										</li>
										<li className="flex w-full items-center justify-between gap-2">
											<span className="text-xs font-semibold tracking-wide uppercase opacity-50">
												Author:
											</span>{' '}
											{author ? (
												<Link
													className="text-sm hocus:underline"
													to="/@{$org}"
													params={{ org: author.username }}
												>
													@{author.username}
												</Link>
											) : (
												<span className="text-sm text-muted-foreground">Unknown</span>
											)}
										</li>
										<li className="flex w-full items-center justify-between gap-2">
											<span className="text-xs font-semibold tracking-wide uppercase opacity-50">
												Board:
											</span>{' '}
											<BoardSwitcher
												feedbackId={feedback._id}
												currentBoard={board}
												projectSlug={params.project}
												canEdit={canEditStatus}
											/>
										</li>
									</ul>
								</div>
							</div>
						</div>
						<div className="md:col-span-8">
							{/* First comment (initial feedback content) */}
							{firstComment && author && (
								<div className="relative">
									<div className="absolute left-[33px] h-full border-r opacity-50"></div>
									<ul className="flex flex-col gap-6">
										<li className="update-comment relative flex overflow-hidden rounded-lg border">
											<div className="flex flex-col items-center justify-start border-r bg-muted pt-3 pl-4">
												<div className="relative z-10 -mr-4 size-8 overflow-hidden rounded-full border bg-gradient-to-tr from-white/50 to-accent shadow-xl shadow-black">
													{author.imageUrl ? (
														<img className="size-8" src={author.imageUrl} alt={author.username} />
													) : (
														<div className="flex size-8 items-center justify-center bg-primary text-xs font-bold text-primary-foreground">
															{author.name?.charAt(0) ?? '?'}
														</div>
													)}
												</div>
											</div>
											<div className="flex w-full flex-col bg-background">
												<div className="flex w-full justify-between gap-2 border-b px-6 py-4">
													<span>
														<Link
															className="hocus:underline"
															to="/@{$org}"
															params={{ org: author.username }}
														>
															@{author.username}
														</Link>
														{' '}
														<span className="text-muted-foreground">opened this feedback</span>
													</span>
													<div className="text-muted-foreground">
														{formatTimestamp(firstComment._creationTime)}
													</div>
												</div>
												<div className="flex flex-col gap-4 p-6">
													<EditorContentDisplay content={firstComment.content} />
													{/* TODO: Future feature - Comment attachments
													<div className="flex flex-col gap-2">
														<span className="text-xs font-bold tracking-wide uppercase opacity-25 select-none">
															Attachments
														</span>
														<div className="flex gap-2">
															{attachments.map((attachment) => (
																<button key={attachment} className="...">
																	<img src={attachment} alt="" />
																</button>
															))}
														</div>
													</div>
													*/}
													{/* Emoji reactions */}
													<div className="flex items-center gap-2">
														<EmotePicker feedbackId={feedback._id} commentId={firstComment._id} currentProfileId={currentProfile?._id} />
														{firstCommentWithEmotes &&
															(
																Object.entries(firstCommentWithEmotes.emoteCounts) as [
																	EmoteContent,
																	{ count: number; authorProfileIds: string[] },
																][]
															).map(([emoteType, data]) => (
																<EmoteButton
																	key={emoteType}
																	feedbackId={feedback._id}
																	commentId={firstComment._id}
																	emoteType={emoteType}
																	count={data.count}
																	isActive={
																		currentProfile?._id
																			? data.authorProfileIds.includes(currentProfile._id)
																			: false
																	}
																	currentProfileId={currentProfile?._id}
																/>
															))}
													</div>
												</div>
											</div>
										</li>
									</ul>
								</div>
							)}

							<EditorRefProvider>
								{/* Additional comments */}
								<CommentsList feedbackId={feedback._id} currentProfileId={currentProfile?._id} />

								{/* Comment form */}
								<CommentForm feedbackId={feedback._id} />
							</EditorRefProvider>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
