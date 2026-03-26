import { convexQuery } from '@convex-dev/react-query';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, notFound } from '@tanstack/react-router';
import {
	Bell,
	Calendar,
	ChevronDown,
	ChevronRight,
	Info,
	Link as LinkIcon,
	Plus,
	Tag,
	Users,
} from 'lucide-react';

import { api } from '~api';
import { EditorRefProvider } from '@/components/editor';
import { ProfileLinkOrUnknown } from '@/components/profile-link';
import { RoutePending } from '@/components/route-pending';
import { SidebarSection } from '@/components/sidebar-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusIcon } from '@/icons';
import { useSidebarState } from '@/lib/hooks/use-sidebar-state';
import { formatTimestamp } from '@/lib/utils/format-timestamp';

import { AssigneeSwitcher } from '../-components/assignee-switcher';
import { BoardSwitcher } from '../-components/board-switcher';
import { CommentForm } from '../-components/comment-form';
import { FeedbackComment } from '../-components/feedback-comment';
import { FeedbackTimeline } from '../-components/feedback-timeline';
import { StatusSwitcher } from '../-components/status-switcher';
import { UpvoteButton } from '../-components/upvote-button';

const SIDEBAR_STORAGE_KEY = 'feedback-detail-sidebar-state';

type SidebarSections = {
	details: boolean;
	people: boolean;
	labels: boolean;
	related: boolean;
};

const DEFAULT_SIDEBAR_STATE: SidebarSections = {
	details: true,
	people: true,
	labels: true,
	related: true,
};

export const Route = createFileRoute('/@{$org}/$project/feedback/$slug/')({
	loader: async ({ context, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			convexQuery(api.project.getDetails, {
				orgSlug: params.org,
				slug: params.project,
			})
		);

		if (!projectData?.project?._id) {
			throw notFound();
		}

		const feedbackData = await context.queryClient.ensureQueryData(
			convexQuery(api.feedback.getBySlug, {
				projectId: projectData.project._id,
				slug: params.slug,
			})
		);

		if (!feedbackData) {
			throw notFound();
		}
	},
	pendingComponent: () => <RoutePending variant='detail' />,
	pendingMs: 150,
	component: RouteComponent,
});

function RouteComponent() {
	const params = Route.useParams();

	const { data: projectData } = useSuspenseQuery(
		convexQuery(api.project.getDetails, {
			orgSlug: params.org,
			slug: params.project,
		})
	);

	if (!projectData?.project?._id) {
		throw notFound();
	}

	const { data: feedbackData } = useSuspenseQuery(
		convexQuery(api.feedback.getBySlug, {
			projectId: projectData.project._id,
			slug: params.slug,
		})
	);

	if (!feedbackData) {
		throw notFound();
	}

	// Get current user's profile for highlighting their emotes
	const { data: currentProfile } = useQuery(convexQuery(api.profile.findMyProfile, {}));

	// Sidebar collapse state with localStorage persistence
	const { state: sidebarState, setSection: setSidebarSection } = useSidebarState(
		SIDEBAR_STORAGE_KEY,
		DEFAULT_SIDEBAR_STATE
	);

	// Get comments with emotes for the first comment
	const { data: comments } = useSuspenseQuery(
		convexQuery(api.feedbackComment.listByFeedback, {
			feedbackId: feedbackData?.feedback._id!,
		})
	);

	// Get events for the timeline
	const { data: events } = useSuspenseQuery(
		convexQuery(api.feedbackEvent.listByFeedback, {
			feedbackId: feedbackData?.feedback._id!,
		})
	);

	const { feedback, author, board, firstComment, assignedProfile, hasUpvoted } = feedbackData;

	// Find the first comment with emotes from the comments list
	const firstCommentWithEmotes = comments?.find((c) => c._id === firstComment?._id);

	// Determine if user can edit status (owner or has project edit permissions)
	const isOwner = currentProfile?._id === feedback.authorProfileId;
	const canEditStatus = isOwner || (projectData?.permissions?.canEdit ?? false);
	const isAuthenticated = !!currentProfile;

	return (
		<div className='container h-full grid-cols-12 gap-8 md:grid'>
			{/* Sidebar (right) */}
			<div className='order-first border-l border-border/75 py-6 md:order-last md:col-span-4'>
				<div className='sticky top-4 flex flex-col gap-6 pl-8'>
					{/* Upvote Section */}
					<div>
						<div className='flex items-center gap-3'>
							<UpvoteButton
								feedbackId={feedback._id}
								initialCount={feedback.upvotes}
								initialHasUpvoted={hasUpvoted}
								isAuthenticated={isAuthenticated}
							/>
							<div className='flex-1'>
								<div className='text-sm font-medium'>
									{feedback.upvotes} upvote{feedback.upvotes !== 1 ? 's' : ''}
								</div>
								<div className='text-xs text-muted-foreground'>
									{hasUpvoted ? "You've upvoted this" : 'Show your support'}
								</div>
							</div>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button variant='ghost' size='icon' className='size-8'>
										<Bell className='size-4' />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Subscribe to updates</TooltipContent>
							</Tooltip>
						</div>
					</div>

					{/* Details Section */}
					<SidebarSection
						title='Details'
						icon={<Info className='size-3.5' />}
						open={sidebarState.details}
						onOpenChange={(open) => setSidebarSection('details', open)}
					>
						<div className='flex flex-col'>
							{/* Status */}
							<div className='flex items-center justify-between py-1.5'>
								<span className='text-sm text-muted-foreground'>Status</span>
								<StatusSwitcher
									feedbackId={feedback._id}
									currentStatus={feedback.status}
									canEdit={canEditStatus}
								/>
							</div>

							{/* Board */}
							<div className='flex items-center justify-between py-1.5'>
								<span className='text-sm text-muted-foreground'>Board</span>
								<BoardSwitcher
									feedbackId={feedback._id}
									currentBoard={board}
									projectSlug={params.project}
									canEdit={canEditStatus}
								/>
							</div>

							{/* Priority - Placeholder */}
							<div className='flex items-center justify-between py-1.5'>
								<span className='text-sm text-muted-foreground'>Priority</span>
								<Button variant='outline' size='sm' className='h-auto gap-1.5 px-2 py-1 text-xs'>
									<span className='size-2 rounded-full bg-amber-500' />
									Medium
									<ChevronDown size={12} />
								</Button>
							</div>

							{/* Due Date - Placeholder */}
							<div className='flex items-center justify-between py-1.5'>
								<span className='text-sm text-muted-foreground'>Due date</span>
								<Button
									variant='ghost'
									size='sm'
									className='h-auto px-2 py-1 text-xs text-muted-foreground'
								>
									<Calendar className='mr-1.5 size-3' />
									Set date
								</Button>
							</div>
						</div>
					</SidebarSection>

					{/* People Section */}
					<SidebarSection
						title='People'
						icon={<Users className='size-3.5' />}
						open={sidebarState.people}
						onOpenChange={(open) => setSidebarSection('people', open)}
					>
						<div className='flex flex-col'>
							{/* Assignee */}
							<div className='flex items-center justify-between py-1.5'>
								<span className='text-sm text-muted-foreground'>Assignee</span>
								<AssigneeSwitcher
									feedbackId={feedback._id}
									assignedProfile={assignedProfile}
									projectId={projectData?.project?._id!}
									canEdit={canEditStatus}
								/>
							</div>

							{/* Author */}
							<div className='flex items-center justify-between py-1.5'>
								<span className='text-sm text-muted-foreground'>Author</span>
								<ProfileLinkOrUnknown profile={author} display='name' />
							</div>

							{/* Watchers - Placeholder */}
							<div className='flex items-center justify-between py-1.5'>
								<span className='text-sm text-muted-foreground'>Watchers</span>
								<div className='flex items-center -space-x-1.5'>
									<div className='size-5 rounded-full border-2 border-background bg-emerald-500' />
									<div className='size-5 rounded-full border-2 border-background bg-blue-500' />
									<div className='size-5 rounded-full border-2 border-background bg-purple-500' />
									<span className='ml-2 text-xs text-muted-foreground'>+12</span>
								</div>
							</div>
						</div>
					</SidebarSection>

					{/* Labels Section - Placeholder */}
					<SidebarSection
						title='Labels'
						icon={<Tag className='size-3.5' />}
						open={sidebarState.labels}
						onOpenChange={(open) => setSidebarSection('labels', open)}
					>
						<div className='flex flex-wrap items-center gap-1.5'>
							<Badge variant='secondary' className='gap-1 font-normal'>
								<span className='size-1.5 rounded-full bg-blue-500' />
								feature-request
							</Badge>
							<Badge variant='secondary' className='gap-1 font-normal'>
								<span className='size-1.5 rounded-full bg-purple-500' />
								ux
							</Badge>
							<Badge variant='secondary' className='gap-1 font-normal'>
								<span className='size-1.5 rounded-full bg-emerald-500' />
								enhancement
							</Badge>
							<Button
								variant='ghost'
								size='sm'
								className='h-6 gap-1 px-2 text-xs text-muted-foreground'
							>
								<Plus className='size-3' />
								Add
							</Button>
						</div>
					</SidebarSection>

					{/* Related Section - Placeholder */}
					<SidebarSection
						title='Related'
						icon={<LinkIcon className='size-3.5' />}
						open={sidebarState.related}
						onOpenChange={(open) => setSidebarSection('related', open)}
					>
						<div className='flex flex-col'>
							<div className='flex cursor-pointer items-center gap-2.5 rounded-md py-2 transition-colors hover:bg-muted/50'>
								<StatusIcon status='completed' size='14' colored />
								<span className='flex-1 truncate text-sm'>Add dark mode support</span>
								<ChevronRight className='size-4 text-muted-foreground' />
							</div>
							<div className='flex cursor-pointer items-center gap-2.5 rounded-md py-2 transition-colors hover:bg-muted/50'>
								<StatusIcon status='in-progress' size='14' colored />
								<span className='flex-1 truncate text-sm'>Improve mobile responsiveness</span>
								<ChevronRight className='size-4 text-muted-foreground' />
							</div>
							<Button
								variant='ghost'
								size='sm'
								className='mt-1 h-8 w-full justify-start gap-1.5 px-0 text-xs text-muted-foreground'
							>
								<Plus className='size-3' />
								Link related feedback
							</Button>
						</div>
					</SidebarSection>
				</div>
			</div>

			{/* Main content */}
			<div className='flex flex-col gap-4 py-8 md:col-span-8'>
				{/* Title header — border extends into sidebar via negative margin */}
				<div className='mb-6 flex items-start gap-4 border-b pt-6 pb-6 md:-mr-8.25'>
					<div className='mt-1'>
						<StatusIcon status={feedback.status} size='28' colored />
					</div>
					<div className='flex flex-1 flex-col gap-2'>
						<h1 className='text-3xl'>{feedback.title}</h1>
						<div className='text-sm text-muted-foreground'>
							<span suppressHydrationWarning>
								{feedback.status === 'open' ? 'Opened' : 'Updated'}{' '}
								{formatTimestamp(feedback._creationTime)} · {feedback.upvotes} upvote
								{feedback.upvotes !== 1 ? 's' : ''}
							</span>
						</div>
					</div>
				</div>

				{/* First comment (initial feedback content) */}
				{firstComment && author && (
					<FeedbackComment
						variant='initial'
						comment={{
							_id: firstComment._id,
							content: firstComment.content,
							_creationTime: firstComment._creationTime,
							updatedTime: firstComment.updatedTime,
							author,
							emoteCounts: firstCommentWithEmotes?.emoteCounts ?? {},
							isTeamMember: firstCommentWithEmotes?.isTeamMember ?? false,
						}}
						feedback={{
							_id: feedback._id,
							authorProfileId: feedback.authorProfileId,
						}}
						currentProfileId={currentProfile?._id}
					/>
				)}

				<EditorRefProvider>
					{/* Additional comments and events timeline */}
					<FeedbackTimeline
						feedback={{
							_id: feedback._id,
							authorProfileId: feedback.authorProfileId,
							answerCommentId: feedback.answerCommentId,
						}}
						events={events ?? []}
						currentProfileId={currentProfile?._id}
						canMarkAnswer={canEditStatus}
					/>

					{/* Comment form */}
					<CommentForm
						feedbackId={feedback._id}
						orgSlug={params.org}
						projectSlug={params.project}
						feedbackSlug={params.slug}
						isAuthenticated={!!currentProfile}
					/>
				</EditorRefProvider>
			</div>
		</div>
	);
}
