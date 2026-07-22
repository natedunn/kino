import type { TargetGranularity } from '@convex/target';
import type { CSSProperties, FormEvent, KeyboardEvent } from 'react';
import type { ThreadComment } from '../../-components/comment-thread';
import type { GitHubConnectionData, ProfileSummary, TimelineItem } from './-types';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
	dateFromDayTarget,
	formatTargetOrUnscheduled,
	getDaysInMonth,
	getQuarterFromDate,
	isValidTarget,
	pad2,
	parseMonthParts,
	parseQuarterParts,
} from '@convex/target';
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, getRouteApi, Link, notFound, useNavigate } from '@tanstack/react-router';
import { useAuth } from 'kitcn/react';
import {
	Bell,
	Calendar as CalendarIcon,
	Check,
	ChevronRight,
	ExternalLink,
	GitBranch,
	Info,
	Link as LinkIcon,
	MessageSquare,
	MoreHorizontal,
	Plus,
	Tag,
	Trash2,
	Users,
	X as XIcon,
} from 'lucide-react';

import { BoardIcon } from '@/components/board-icon';
import { ProfileLinkOrUnknown } from '@/components/profile-link';
import { SidebarSection } from '@/components/sidebar-section';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from '@/components/ui/drawer';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EditIcon, StatusIcon } from '@/icons';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useSidebarState } from '@/lib/hooks/use-sidebar-state';
import { projectTitle, titleFromSlug, titleMeta } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { formatTimestamp, toTimestamp } from '@/lib/utils/format-timestamp';
import { FORM_LIMITS } from '@/lib/validation';

import { UpvoteButton } from '../-components/upvote-button';
import { CommentCard, CommentEditorProvider, CommentForm } from '../../-components/comment-thread';
import { FeedbackEventItem } from './-components/feedback-event-item';
import {
	GitHubConnectionDialog,
	GithubConnectionIcon,
	GithubIssueStateBadge,
} from './-components/github-connection-dialog';

const SIDEBAR_STORAGE_KEY = 'feedback-detail-sidebar-state';

const DEFAULT_SIDEBAR_STATE = {
	connections: true,
	details: true,
	labels: true,
	people: true,
	related: true,
};

const FEEDBACK_STATUS_OPTIONS = [
	{ label: 'Open', value: 'open' },
	{ label: 'In progress', value: 'in-progress' },
	{ label: 'Paused', value: 'paused' },
	{ label: 'Completed', value: 'completed' },
	{ label: 'Closed', value: 'closed' },
] as const;

const FEEDBACK_PRIORITY_OPTIONS = [
	{ dotClass: 'bg-muted-foreground/40', label: 'None', value: 'none' },
	{ dotClass: 'bg-sky-500', label: 'Low', value: 'low' },
	{ dotClass: 'bg-amber-500', label: 'Medium', value: 'medium' },
	{ dotClass: 'bg-orange-500', label: 'High', value: 'high' },
	{ dotClass: 'bg-red-500', label: 'Urgent', value: 'urgent' },
] as const;

const TARGET_GRANULARITY_OPTIONS: Array<{
	label: string;
	value: TargetGranularity;
}> = [
	{ label: 'Day', value: 'day' },
	{ label: 'Month', value: 'month' },
	{ label: 'Quarter', value: 'quarter' },
	{ label: 'Year', value: 'year' },
];

const QUARTER_OPTIONS = [
	{ label: 'Quarter 1 (Q1)', value: 'Q1' },
	{ label: 'Quarter 2 (Q2)', value: 'Q2' },
	{ label: 'Quarter 3 (Q3)', value: 'Q3' },
	{ label: 'Quarter 4 (Q4)', value: 'Q4' },
] as const;

const MONTH_OPTIONS = [
	{ label: 'January (01)', value: '01' },
	{ label: 'February (02)', value: '02' },
	{ label: 'March (03)', value: '03' },
	{ label: 'April (04)', value: '04' },
	{ label: 'May (05)', value: '05' },
	{ label: 'June (06)', value: '06' },
	{ label: 'July (07)', value: '07' },
	{ label: 'August (08)', value: '08' },
	{ label: 'September (09)', value: '09' },
	{ label: 'October (10)', value: '10' },
	{ label: 'November (11)', value: '11' },
	{ label: 'December (12)', value: '12' },
] as const;

// How far the granularity nav slides its panel in; index order mirrors the nav (L→R).
const GRANULARITY_ORDER: Array<TargetGranularity> = ['day', 'month', 'quarter', 'year'];

// Local edit state for the target drawer. Each field persists independently so switching
// granularity never wipes the others (year carries everywhere; month/day carry between the
// day and month ranges; quarter keeps its own value).
type TargetFields = {
	day: string; // "15"
	month: string; // "07"
	quarter: string; // "Q1"
	year: string; // "2026"
};

function quarterFromMonth(month: number) {
	return `Q${Math.floor((month - 1) / 3) + 1}`;
}

// Seed the drawer fields from an existing target (falling back to today for anything the
// target doesn't specify) and pick the granularity to open on.
function resolveInitialTargetState(
	currentTarget: string | null,
	currentGranularity: TargetGranularity | null
): { fields: TargetFields; granularity: TargetGranularity } {
	const now = new Date();
	const fields: TargetFields = {
		day: pad2(now.getDate()),
		month: pad2(now.getMonth() + 1),
		quarter: `Q${getQuarterFromDate(now)}`,
		year: String(now.getFullYear()),
	};

	if (!currentTarget || !currentGranularity || !isValidTarget(currentTarget, currentGranularity)) {
		return { fields, granularity: 'quarter' };
	}

	switch (currentGranularity) {
		case 'day': {
			const date = dateFromDayTarget(currentTarget);
			if (date) {
				fields.year = String(date.getFullYear());
				fields.month = pad2(date.getMonth() + 1);
				fields.day = pad2(date.getDate());
				fields.quarter = quarterFromMonth(date.getMonth() + 1);
			}
			break;
		}
		case 'month': {
			const parsed = parseMonthParts(currentTarget);
			if (parsed) {
				fields.year = String(parsed.year);
				fields.month = pad2(parsed.month);
				fields.quarter = quarterFromMonth(parsed.month);
			}
			break;
		}
		case 'quarter': {
			const parsed = parseQuarterParts(currentTarget);
			if (parsed) {
				fields.year = String(parsed.year);
				fields.quarter = `Q${parsed.quarter}`;
			}
			break;
		}
		case 'year':
			fields.year = currentTarget;
			break;
	}

	return { fields, granularity: currentGranularity };
}

// Build the target token string the mutation expects from the current field values.
function targetTokenFromFields(granularity: TargetGranularity, fields: TargetFields) {
	const yearNum = Number(fields.year);
	const monthNum = Number(fields.month);
	switch (granularity) {
		case 'day': {
			const maxDay = getDaysInMonth(yearNum, monthNum);
			const clampedDay = Math.min(Math.max(Number(fields.day) || 1, 1), maxDay);
			return `${fields.year}-${fields.month}-${pad2(clampedDay)}`;
		}
		case 'month':
			return `${fields.year}-${fields.month}`;
		case 'quarter':
			return `${fields.year}-${fields.quarter}`;
		case 'year':
			return fields.year;
	}
}

// Year options: a compact rolling range, plus the seeded value so existing targets
// outside the range stay visible/selectable.
function buildYearOptions(seedYear: number) {
	const currentYear = new Date().getFullYear();
	const years = new Set<number>();
	for (let year = currentYear - 10; year <= currentYear + 10; year++) {
		years.add(year);
	}
	years.add(seedYear);
	return [...years]
		.sort((a, b) => a - b)
		.map((year) => ({ label: String(year), value: String(year) }));
}

// Day-of-month options sized to the selected month/year.
function buildDayOptions(year: number, month: number) {
	const total = getDaysInMonth(year, month);
	const options: Array<{ label: string; value: string }> = [];
	for (let day = 1; day <= total; day++) {
		options.push({ label: String(day), value: pad2(day) });
	}
	return options;
}

const routeApi = getRouteApi('/@{$org}/$project/feedback/$slug/');

export const Route = createFileRoute('/@{$org}/$project/feedback/$slug/')({
	component: FeedbackDetailRoute,
	loader: async ({ context, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({
				orgSlug: params.org,
				slug: params.project,
			})
		);

		if (!projectData?.project?.id) {
			throw notFound();
		}

		const feedbackData = await context.queryClient.ensureQueryData(
			crpcServer.feedback.getDetailCritical.queryOptions({
				projectId: projectData.project.id,
				slug: params.slug,
			})
		);

		if (!feedbackData?.feedback) {
			throw notFound();
		}

		return {
			createdAt: feedbackData.feedback.createdAt,
			feedbackId: feedbackData.feedback.id,
			projectId: projectData.project.id,
			status: feedbackData.feedback.status,
			title: feedbackData.feedback.title,
			upvotes: feedbackData.feedback.upvotes,
		};
	},
	head: ({ loaderData, params }) => ({
		meta: [
			titleMeta([
				loaderData?.title ?? titleFromSlug(params.slug),
				projectTitle(params.org, params.project),
			]),
		],
	}),
});

type TimelineMiddleState = {
	items: Array<TimelineItem>;
	cursor: string | null;
	key: string;
	pageCount: number;
};

function dedupeTimeline(items: Array<TimelineItem>) {
	const seen = new Set<string>();
	return items.filter((item) => {
		const key = `${item.type}:${item.id}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function createTimelineMiddleState(key: string, cursor: string | null): TimelineMiddleState {
	return {
		items: [],
		cursor,
		key,
		pageCount: 0,
	};
}

function FeedbackDetailRoute() {
	const params = routeApi.useParams();
	const crpc = useCRPC();

	const { data: projectData } = useSuspenseQuery(
		crpc.project.getDetails.queryOptions({
			orgSlug: params.org,
			slug: params.project,
		})
	);

	if (!projectData?.project?.id) {
		throw notFound();
	}

	const { data: feedbackData } = useSuspenseQuery(
		crpc.feedback.getDetailCritical.queryOptions({
			projectId: projectData.project.id,
			slug: params.slug,
		})
	);

	if (!feedbackData?.feedback) {
		throw notFound();
	}

	return (
		<FeedbackDetailContent
			crpc={crpc}
			feedbackData={feedbackData}
			params={params}
			projectData={projectData}
		/>
	);
}

function FeedbackDetailContent({
	crpc,
	feedbackData,
	params,
	projectData,
}: {
	crpc: ReturnType<typeof useCRPC>;
	feedbackData: any;
	params: ReturnType<typeof routeApi.useParams>;
	projectData: any;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const auth = useAuth();
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deleteConfirmText, setDeleteConfirmText] = useState('');
	const [deleteError, setDeleteError] = useState('');
	const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
	const [targetDrawerOpen, setTargetDrawerOpen] = useState(false);
	const feedback = feedbackData.feedback;
	const timeline = feedbackData.timeline;
	// Cursors that bound the collapsed middle of the merged (comments + events)
	// timeline: `middleStartCursor` marks where the middle begins (just after the
	// head), `middleEndCursor` marks the tail boundary. Both come from the live
	// `getDetailCritical` window.
	const middleStartCursor: string | null = timeline.middleCursor ?? null;
	const middleEndCursor: string | null = timeline.middleEndCursor ?? null;
	const middleStateKey = `${feedback.id}:${middleStartCursor ?? ''}`;
	const initialMiddleState = () => createTimelineMiddleState(middleStateKey, middleStartCursor);
	const [middleState, setMiddleState] = useState<TimelineMiddleState>(initialMiddleState);
	// When the feedback or server middle-cursor changes, `middleStateKey` changes
	// and this render derives a fresh (collapsed) snapshot instead of resetting
	// via an effect. The STORED `middleState` is not rewritten here — it keeps its
	// old key/items until the next `updateMiddleState`, which re-bases onto a
	// fresh initial when it sees a stale key. Always read the snapshot through
	// `activeMiddleState`; reading `middleState` directly can surface a previous
	// feedback's items after navigation.
	const activeMiddleState = middleState.key === middleStateKey ? middleState : initialMiddleState();
	const middleItems = activeMiddleState.items;
	const middleCursor = activeMiddleState.cursor;
	// How many middle pages the viewer has expanded. Middle pages are a snapshot
	// (not a live subscription) to avoid holding a subscription open over a long
	// thread; we track the count so we can re-fetch exactly the expanded range
	// when the viewer mutates a comment. A hard refresh or navigating away and
	// back remounts this component, which re-initializes the snapshot (collapsed)
	// and re-reads the live head/tail — so those paths are always fresh.
	const middlePageCount = activeMiddleState.pageCount;
	const [isLoadingMiddleComments, setIsLoadingMiddleComments] = useState(false);
	const { state: sidebarState, setSection: setSidebarSection } = useSidebarState(
		SIDEBAR_STORAGE_KEY,
		DEFAULT_SIDEBAR_STATE
	);

	const updateMiddleState = (updater: (current: TimelineMiddleState) => TimelineMiddleState) => {
		setMiddleState((current) =>
			updater(current.key === middleStateKey ? current : initialMiddleState())
		);
	};

	const interactiveQuery = useQuery(
		crpc.feedback.getDetailInteractive.queryOptions(
			{
				feedbackId: feedback.id,
				projectId: projectData.project.id,
			},
			{ enabled: !!feedback.id }
		)
	);
	const githubConnectionsQuery = useQuery(
		crpc.feedbackGithub.listByFeedback.queryOptions(
			{
				feedbackId: feedback.id,
			},
			{ enabled: !!feedback.id }
		)
	);
	const boardsQuery = useQuery(
		crpc.feedbackBoard.listProjectBoards.queryOptions(
			{
				projectId: projectData.project.id,
			},
			{ enabled: !!projectData.project.id }
		)
	);
	const assignableQuery = useQuery(
		crpc.projectMember.listAssignableMembers.queryOptions(
			{
				projectId: projectData.project.id,
			},
			{ enabled: !!projectData.permissions.canEdit, skipUnauth: true }
		)
	);

	const currentProfile = interactiveQuery.data?.currentProfile;
	const assignedProfile = interactiveQuery.data?.assignedProfile;
	const isAuthenticated = auth.hasSession || auth.isAuthenticated;
	const canEditStatus =
		feedback.authorProfileId === currentProfile?.id || projectData.permissions.canEdit;
	// Priority is editor/admin-only — the feedback author cannot change it.
	const canEditPriority = projectData.permissions.canEdit;
	const canMarkAnswer = interactiveQuery.data?.canMarkAnswer ?? false;
	// The pinned "opened this feedback" comment, already enriched (author, emote
	// counts, permissions) by `getDetailCritical`.
	const firstComment = feedbackData.firstComment;
	const boardOptions = feedbackData.board
		? [
				feedbackData.board,
				...(boardsQuery.data ?? []).filter(
					(board: { id: string }) => board.id !== feedbackData.board?.id
				),
			]
		: (boardsQuery.data ?? []);
	const assigneeOptions = assignedProfile
		? [
				{
					profile: assignedProfile,
					profileId: assignedProfile.id,
				},
				...(assignableQuery.data ?? []).filter(
					(member: { profileId: string }) => member.profileId !== assignedProfile.id
				),
			]
		: (assignableQuery.data ?? []);
	const statusSelectItems = FEEDBACK_STATUS_OPTIONS.map((status) => ({
		label: (
			<span className='inline-flex items-center gap-1.5'>
				<StatusIcon colored size='14' status={status.value} />
				{status.label}
			</span>
		),
		value: status.value,
	}));
	const prioritySelectItems = FEEDBACK_PRIORITY_OPTIONS.map((priority) => ({
		label: (
			<span className='inline-flex items-center gap-1.5'>
				<span className={`size-2 rounded-full ${priority.dotClass}`} />
				{priority.label}
			</span>
		),
		value: priority.value,
	}));
	const boardSelectItems = boardOptions.map((board: { id: string; name: string }) => ({
		label: board.name,
		value: board.id,
	}));
	const assigneeSelectItems = [
		{ label: 'Unassigned', value: '' },
		...assigneeOptions.map((member: { profile?: ProfileSummary | null; profileId: string }) => ({
			label: member.profile?.name ?? member.profile?.username ?? 'Unknown',
			value: member.profileId,
		})),
	];

	const statusMutation = useMutation(crpc.feedback.updateStatus.mutationOptions());
	const priorityMutation = useMutation(crpc.feedback.updatePriority.mutationOptions());
	const titleMutation = useMutation(crpc.feedback.updateTitle.mutationOptions());
	const boardMutation = useMutation(crpc.feedback.updateBoard.mutationOptions());
	const targetMutation = useMutation(crpc.feedback.updateTarget.mutationOptions());
	const assigneeMutation = useMutation(crpc.feedback.updateAssigned.mutationOptions());
	const answerMutation = useMutation(crpc.feedback.setAnswerComment.mutationOptions());
	const commentCreateMutation = useMutation(crpc.feedbackComment.create.mutationOptions());
	const commentUpdateMutation = useMutation(
		crpc.feedbackComment.update.mutationOptions({
			onSuccess: () => {
				void revalidateMiddleComments();
			},
		})
	);
	const commentDeleteMutation = useMutation(
		crpc.feedbackComment.remove.mutationOptions({
			onSuccess: () => {
				void revalidateMiddleComments();
			},
		})
	);
	const commentEmoteMutation = useMutation(
		crpc.feedbackCommentEmote.toggle.mutationOptions({
			onSuccess: () => {
				void revalidateMiddleComments();
			},
		})
	);
	const refreshGithubConnectionsMutation = useMutation(
		crpc.feedbackGithub.refreshCounts.mutationOptions()
	);
	const deleteMutation = useMutation(
		crpc.feedback.remove.mutationOptions({
			onError: (error) => setDeleteError(error.message),
			onSuccess: () => {
				setDeleteDialogOpen(false);
				navigate({
					params: { org: params.org, project: params.project },
					to: '/@{$org}/$project/feedback',
				});
			},
		})
	);

	const canSubmitDelete = deleteConfirmText === 'DELETE' && !deleteMutation.isPending;
	const visibleGithubConnections = githubConnectionsQuery.data ?? [];
	const showGithubConnectionsSection =
		projectData.permissions.canEdit || visibleGithubConnections.length > 0;

	async function handleLoadMiddleComments() {
		if (!middleCursor || isLoadingMiddleComments) return;

		try {
			setIsLoadingMiddleComments(true);
			const result = await queryClient.fetchQuery(
				crpc.feedback.getMiddleComments.staticQueryOptions({
					cursor: middleCursor,
					endCursor: middleEndCursor,
					feedbackId: feedback.id,
				})
			);
			updateMiddleState((current) => ({
				...current,
				items: dedupeTimeline([...current.items, ...result.items]),
				cursor: result.nextCursor ?? null,
				pageCount: current.pageCount + 1,
			}));
		} finally {
			setIsLoadingMiddleComments(false);
		}
	}

	// Re-fetch exactly the middle pages the viewer has expanded, forcing a fresh
	// network read so a comment they just edited/deleted/reacted to is reflected.
	// No-op when nothing in the middle is expanded.
	async function revalidateMiddleComments() {
		const startCursor = middleStartCursor;
		if (!startCursor || middlePageCount === 0) return;

		let cursor: string | null = startCursor;
		let nextCursor: string | null = null;
		const refreshed: Array<TimelineItem> = [];

		for (let page = 0; page < middlePageCount && cursor; page++) {
			const options = crpc.feedback.getMiddleComments.staticQueryOptions({
				cursor,
				endCursor: middleEndCursor,
				feedbackId: feedback.id,
			});
			await queryClient.invalidateQueries({ queryKey: options.queryKey });
			const result = await queryClient.fetchQuery(options);
			refreshed.push(...result.items);
			nextCursor = result.nextCursor ?? null;
			cursor = nextCursor;
		}

		updateMiddleState((current) => ({
			...current,
			items: dedupeTimeline(refreshed),
			cursor: nextCursor,
		}));
	}

	async function handleCreateComment(content: string) {
		await commentCreateMutation.mutateAsync({
			content,
			feedbackId: feedback.id,
		});
		await revalidateMiddleComments();
	}

	useEffect(() => {
		if (!projectData.permissions.canEdit) return;
		if (visibleGithubConnections.length === 0) return;
		if (refreshGithubConnectionsMutation.isPending) return;

		// `listByFeedback` is a live subscription — refreshing the counts
		// server-side pushes the new data, so no manual refetch is needed.
		refreshGithubConnectionsMutation.mutate({ feedbackId: feedback.id });
		// `refreshGithubConnectionsMutation` is a mutation object (unstable ref);
		// key this off the feedback/connection state, not the mutation identity.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [feedback.id, visibleGithubConnections.length, projectData.permissions.canEdit]);

	// The merged timeline is already ordered server-side (head → middle → tail);
	// dedupe overlaps (short threads share head/tail) and sort defensively.
	const timelineItems = useMemo(
		() =>
			dedupeTimeline([...timeline.head, ...middleItems, ...timeline.tail]).sort(
				(a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
			),
		[timeline.head, timeline.tail, middleItems]
	);
	const tailItemIds = useMemo(
		() => new Set((timeline.tail as Array<TimelineItem>).map((item) => item.id)),
		[timeline.tail]
	);
	// Anchor the "Show more comments" button after the last currently-loaded
	// non-tail item, so it sits just above the tail and moves down as more middle
	// pages load. Anchoring to a fixed head item leaves the button stranded above
	// freshly-loaded middle items.
	const middleButtonAnchorId = useMemo(() => {
		for (let index = timelineItems.length - 1; index >= 0; index--) {
			const item = timelineItems[index];
			if (!tailItemIds.has(item.id)) {
				return item.id;
			}
		}
		return null;
	}, [timelineItems, tailItemIds]);
	const middleCommentsButton = middleCursor ? (
		<li className='relative z-10 flex justify-center'>
			<Button
				disabled={isLoadingMiddleComments}
				onClick={handleLoadMiddleComments}
				size='sm'
				type='button'
				variant='outline'
			>
				{isLoadingMiddleComments ? 'Loading comments...' : 'Show more comments'}
			</Button>
		</li>
	) : null;

	return (
		<div className='flex flex-1 flex-col'>
			<Dialog
				open={deleteDialogOpen}
				onOpenChange={(open) => {
					setDeleteDialogOpen(open);
					if (!open) {
						setDeleteConfirmText('');
						setDeleteError('');
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete feedback</DialogTitle>
						<DialogDescription>
							This permanently deletes the feedback along with all of its comments, events, upvotes,
							reactions, and GitHub connections. This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<div className='space-y-4'>
						<div className='space-y-2'>
							<label className='text-sm font-medium' htmlFor='delete-feedback'>
								Type DELETE to confirm
							</label>
							<Input
								id='delete-feedback'
								onChange={(event) => setDeleteConfirmText(event.target.value)}
								value={deleteConfirmText}
							/>
						</div>
						{deleteError ? <p className='text-sm text-destructive'>{deleteError}</p> : null}
					</div>
					<DialogFooter>
						<Button onClick={() => setDeleteDialogOpen(false)} type='button' variant='outline'>
							Cancel
						</Button>
						<Button
							disabled={!canSubmitDelete}
							onClick={() => {
								setDeleteError('');
								deleteMutation.mutate({ id: feedback.id });
							}}
							type='button'
							variant='destructive'
						>
							<Trash2 className='size-4' />
							Delete permanently
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<GitHubConnectionDialog
				feedbackId={feedback.id}
				feedbackTitle={feedback.title}
				open={connectionDialogOpen}
				onOpenChange={setConnectionDialogOpen}
				orgSlug={params.org}
				projectSlug={params.project}
			/>
			<FeedbackTargetDrawer
				currentGranularity={feedback.targetGranularity ?? null}
				currentTarget={feedback.target ?? null}
				feedbackId={feedback.id}
				isSaving={targetMutation.isPending}
				onOpenChange={setTargetDrawerOpen}
				onSave={(value) =>
					targetMutation.mutateAsync({
						feedbackId: feedback.id,
						target: value?.target ?? null,
						targetGranularity: value?.targetGranularity ?? null,
					})
				}
				open={targetDrawerOpen}
			/>
			<div className='border-b'>
				<div className='container flex items-start gap-4 pt-10 pb-6'>
					<div className='mt-1'>
						<StatusIcon colored size='28' status={feedback.status} />
					</div>
					<div className='flex flex-1 flex-col gap-2'>
						<InlineFeedbackTitleEditor
							canEdit={canEditStatus}
							isSaving={titleMutation.isPending}
							onSave={(title) => titleMutation.mutateAsync({ id: feedback.id, title })}
							title={feedback.title}
						/>
						<div className='text-sm text-muted-foreground'>
							<span suppressHydrationWarning>
								{feedback.status === 'open' ? 'Opened' : 'Updated'}{' '}
								{formatTimestamp(toTimestamp(feedback.createdAt))} · {feedback.upvotes} upvote
								{feedback.upvotes !== 1 ? 's' : ''}
							</span>
						</div>
					</div>
					<div className='flex shrink-0 items-center gap-1'>
						<UpvoteButton
							feedbackId={feedback.id}
							initialCount={feedback.upvotes}
							initialHasUpvoted={interactiveQuery.data?.hasUpvoted ?? false}
							isAuthenticated={isAuthenticated}
						/>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button className='size-8' size='icon' variant='ghost'>
									<Bell className='size-4' />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Subscribe to updates</TooltipContent>
						</Tooltip>
						{projectData.permissions.canEdit ? (
							<DropdownMenu>
								<Tooltip>
									<TooltipTrigger asChild>
										<DropdownMenuTrigger asChild>
											<Button className='size-8' size='icon' variant='ghost'>
												<MoreHorizontal className='size-4' />
											</Button>
										</DropdownMenuTrigger>
									</TooltipTrigger>
									<TooltipContent>Admin actions</TooltipContent>
								</Tooltip>
								<DropdownMenuContent align='end'>
									<DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} variant='destructive'>
										<Trash2 className='size-4' />
										Delete feedback
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						) : null}
					</div>
				</div>
			</div>
			<div className='container flex flex-1 flex-col'>
				<div className='flex flex-1 flex-col gap-8 md:grid md:grid-cols-12'>
					<div className='order-last py-8 md:col-span-4 md:border-l md:border-border/75'>
						<div className='sticky top-4 flex flex-col gap-6 md:pl-8'>
							<SidebarSection
								icon={<Info className='size-3.5' />}
								onOpenChange={(open) => setSidebarSection('details', open)}
								open={sidebarState.details}
								title='Details'
							>
								<div className='flex flex-col'>
									<div className='flex items-center justify-between py-1.5'>
										<span className='text-sm text-muted-foreground'>Status</span>
										{canEditStatus ? (
											<Select
												items={statusSelectItems}
												onValueChange={(value) =>
													statusMutation.mutate({
														id: feedback.id,
														status: value as never,
													})
												}
												value={feedback.status}
											>
												<SelectTrigger className='min-w-32'>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{FEEDBACK_STATUS_OPTIONS.map((status) => (
														<SelectItem key={status.value} value={status.value}>
															<StatusIcon colored size='14' status={status.value} />
															{status.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										) : (
											<span className='inline-flex items-center gap-1.5 text-sm'>
												<StatusIcon colored size='14' status={feedback.status} />
												{feedback.status}
											</span>
										)}
									</div>

									<div className='flex items-center justify-between py-1.5'>
										<span className='text-sm text-muted-foreground'>Board</span>
										{canEditStatus ? (
											<Select
												items={boardSelectItems}
												onValueChange={(value) =>
													boardMutation.mutate({
														boardId: value,
														id: feedback.id,
													})
												}
												value={feedback.boardId}
											>
												<SelectTrigger className='max-w-56 min-w-32'>
													<SelectValue placeholder='No board' />
												</SelectTrigger>
												<SelectContent>
													{boardOptions.map(
														(board: { icon?: string | null; id: string; name: string }) => (
															<SelectItem key={board.id} value={board.id}>
																<BoardIcon icon={board.icon} name={board.name} size='14px' />
																{board.name}
															</SelectItem>
														)
													)}
												</SelectContent>
											</Select>
										) : (
											<span className='inline-flex items-center gap-1.5 text-sm'>
												{feedbackData.board ? (
													<BoardIcon
														icon={feedbackData.board.icon}
														name={feedbackData.board.name}
														size='14px'
													/>
												) : null}
												{feedbackData.board?.name ?? 'No board'}
											</span>
										)}
									</div>

									<div className='flex items-center justify-between py-1.5'>
										<span className='text-sm text-muted-foreground'>Priority</span>
										{canEditPriority ? (
											<Select
												items={prioritySelectItems}
												onValueChange={(value) =>
													priorityMutation.mutate({
														id: feedback.id,
														priority: value as never,
													})
												}
												value={feedback.priority ?? 'none'}
											>
												<SelectTrigger className='min-w-32'>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{FEEDBACK_PRIORITY_OPTIONS.map((priority) => (
														<SelectItem key={priority.value} value={priority.value}>
															<span className={`size-2 rounded-full ${priority.dotClass}`} />
															{priority.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										) : (
											<span className='inline-flex items-center gap-1.5 text-sm capitalize'>
												<span
													className={`size-2 rounded-full ${
														FEEDBACK_PRIORITY_OPTIONS.find(
															(option) => option.value === (feedback.priority ?? 'none')
														)?.dotClass ?? 'bg-muted-foreground/40'
													}`}
												/>
												{feedback.priority ?? 'none'}
											</span>
										)}
									</div>

									<div className='flex items-center justify-between py-1.5'>
										<span className='text-sm text-muted-foreground'>Target</span>
										{projectData.permissions.canEdit ? (
											<Button
												className='max-w-52 justify-end'
												onClick={() => setTargetDrawerOpen(true)}
												size='default'
												type='button'
												variant='secondary'
											>
												<CalendarIcon className='size-3.5' />
												<span className='truncate'>
													{formatTargetOrUnscheduled(
														feedback.target ?? null,
														feedback.targetGranularity ?? null
													)}
												</span>
											</Button>
										) : (
											<span className='max-w-52 truncate text-sm'>
												{formatTargetOrUnscheduled(
													feedback.target ?? null,
													feedback.targetGranularity ?? null
												)}
											</span>
										)}
									</div>
								</div>
							</SidebarSection>

							{showGithubConnectionsSection ? (
								<SidebarSection
									icon={<GitBranch className='size-3.5' />}
									onOpenChange={(open) => setSidebarSection('connections', open)}
									open={sidebarState.connections}
									title='Connections'
								>
									<div className='flex flex-col'>
										{visibleGithubConnections.length > 0 ? (
											visibleGithubConnections.map((connection: GitHubConnectionData) => (
												<a
													className='group flex min-w-0 items-center gap-2.5 rounded-md py-2 transition-colors hover:bg-muted/50'
													href={connection.url}
													key={connection.id}
													rel='noreferrer'
													target='_blank'
												>
													<GithubConnectionIcon />
													<span className='min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,black_calc(100%_-_1.5rem),transparent)] text-sm whitespace-nowrap [-webkit-mask-image:linear-gradient(to_right,black_calc(100%_-_1.5rem),transparent)]'>
														#{connection.githubNumber} {connection.title}
													</span>
													<GithubIssueStateBadge state={connection.state} />
													<ExternalLink className='size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100' />
												</a>
											))
										) : (
											<p className='py-2 text-sm text-muted-foreground'>
												No GitHub items connected.
											</p>
										)}
										{projectData.permissions.canEdit ? (
											<Button
												className='mt-1 h-8 w-full justify-start gap-1.5 px-0 text-xs text-muted-foreground'
												onClick={() => setConnectionDialogOpen(true)}
												size='sm'
												type='button'
												variant='ghost'
											>
												<Plus className='size-3' />
												Add connection
											</Button>
										) : null}
									</div>
								</SidebarSection>
							) : null}

							<SidebarSection
								icon={<Users className='size-3.5' />}
								onOpenChange={(open) => setSidebarSection('people', open)}
								open={sidebarState.people}
								title='People'
							>
								<div className='flex flex-col'>
									<div className='flex items-center justify-between py-1.5'>
										<span className='text-sm text-muted-foreground'>Assignee</span>
										{canEditStatus ? (
											<Select
												items={assigneeSelectItems}
												onValueChange={(value) =>
													assigneeMutation.mutate({
														assignedProfileId: value || null,
														feedbackId: feedback.id,
													})
												}
												value={feedback.assignedProfileId ?? ''}
											>
												<SelectTrigger className='max-w-48 min-w-32'>
													<SelectValue placeholder='Unassigned' />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value=''>Unassigned</SelectItem>
													{assigneeOptions.map(
														(member: { profile?: ProfileSummary | null; profileId: string }) => (
															<SelectItem key={member.profileId} value={member.profileId}>
																{member.profile?.name ?? member.profile?.username}
															</SelectItem>
														)
													)}
												</SelectContent>
											</Select>
										) : (
											<span className='text-sm'>
												{assignedProfile?.name ?? assignedProfile?.username ?? 'Unassigned'}
											</span>
										)}
									</div>
									<div className='flex items-center justify-between py-1.5'>
										<span className='text-sm text-muted-foreground'>Author</span>
										<ProfileLinkOrUnknown profile={feedbackData.author} display='name' />
									</div>
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

							<SidebarSection
								icon={<Tag className='size-3.5' />}
								onOpenChange={(open) => setSidebarSection('labels', open)}
								open={sidebarState.labels}
								title='Labels'
							>
								<div className='flex flex-wrap items-center gap-1.5'>
									<Badge className='gap-1 font-normal' variant='secondary'>
										<span className='size-1.5 rounded-full bg-blue-500' />
										feature-request
									</Badge>
									<Badge className='gap-1 font-normal' variant='secondary'>
										<span className='size-1.5 rounded-full bg-purple-500' />
										ux
									</Badge>
									<Badge className='gap-1 font-normal' variant='secondary'>
										<span className='size-1.5 rounded-full bg-emerald-500' />
										enhancement
									</Badge>
									<Button
										className='h-6 gap-1 px-2 text-xs text-muted-foreground'
										size='sm'
										variant='ghost'
									>
										<Plus className='size-3' />
										Add
									</Button>
								</div>
							</SidebarSection>

							<SidebarSection
								icon={<LinkIcon className='size-3.5' />}
								onOpenChange={(open) => setSidebarSection('related', open)}
								open={sidebarState.related}
								title='Related'
							>
								<div className='flex flex-col'>
									<div className='flex cursor-pointer items-center gap-2.5 rounded-md py-2 transition-colors hover:bg-muted/50'>
										<StatusIcon colored size='14' status='completed' />
										<span className='flex-1 truncate text-sm'>Add dark mode support</span>
										<ChevronRight className='size-4 text-muted-foreground' />
									</div>
									<div className='flex cursor-pointer items-center gap-2.5 rounded-md py-2 transition-colors hover:bg-muted/50'>
										<StatusIcon colored size='14' status='in-progress' />
										<span className='flex-1 truncate text-sm'>Improve mobile responsiveness</span>
										<ChevronRight className='size-4 text-muted-foreground' />
									</div>
									<Link
										className={cn(
											buttonVariants({ size: 'sm', variant: 'ghost' }),
											'mt-1 h-8 w-full justify-start gap-1.5 px-0 text-xs text-muted-foreground'
										)}
										params={{ org: params.org, project: params.project }}
										to='/@{$org}/$project/feedback'
									>
										<Plus className='size-3' />
										Link related feedback
									</Link>
								</div>
							</SidebarSection>
						</div>
					</div>

					<div className='flex flex-col gap-4 py-8 md:col-span-8'>
						<div className='flex w-full items-center border-b pb-2'>
							<h2 className='flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
								<MessageSquare className='size-3.5' />
								Discussion
							</h2>
						</div>
						<CommentEditorProvider>
							{firstComment || timelineItems.length > 0 ? (
								<ul
									className={cn(
										'relative flex flex-col gap-6',
										timelineItems.length > 0 &&
											'before:absolute before:top-0 before:bottom-0 before:left-[33px] before:z-0 before:border-r before:border-border'
									)}
								>
									{firstComment ? (
										<CommentCard
											badges={
												<>
													<CommentBadge kind='author' label='Author' />
													{firstComment.isTeamMember ? (
														<CommentBadge kind='team' label='Team' />
													) : null}
												</>
											}
											comment={firstComment as ThreadComment}
											currentProfileId={currentProfile?.id}
											isDeleting={commentDeleteMutation.isPending}
											isUpdating={commentUpdateMutation.isPending}
											onDelete={(commentId) => commentDeleteMutation.mutate({ _id: commentId })}
											onToggleEmote={(commentId, content) =>
												commentEmoteMutation.mutate({
													content,
													feedbackCommentId: commentId,
													feedbackId: feedback.id,
												})
											}
											onUpdate={(commentId, content) =>
												commentUpdateMutation.mutateAsync({
													_id: commentId,
													content,
												})
											}
											verb='opened this feedback'
										/>
									) : null}
									{!middleButtonAnchorId ? middleCommentsButton : null}
									{timelineItems.map((item) => (
										<Fragment key={`${item.type}:${item.id}`}>
											{item.type === 'comment' ? (
												<CommentCard
													badges={
														<>
															{item.data.author?.id === feedback.authorProfileId ? (
																<CommentBadge kind='author' label='Author' />
															) : null}
															{item.data.isTeamMember ? (
																<CommentBadge kind='team' label='Team' />
															) : null}
															{feedback.answerCommentId === item.data.id ? (
																<CommentBadge kind='answer' label='Answer' />
															) : null}
														</>
													}
													className={
														feedback.answerCommentId === item.data.id
															? 'border-green-500 dark:border-green-600'
															: undefined
													}
													comment={item.data as ThreadComment}
													currentProfileId={currentProfile?.id}
													dropdownItems={
														canMarkAnswer ? (
															<DropdownMenuItem
																onClick={() =>
																	answerMutation.mutate({
																		commentId:
																			feedback.answerCommentId === item.data.id
																				? null
																				: item.data.id,
																		feedbackId: feedback.id,
																	})
																}
															>
																<Check size={14} />
																{feedback.answerCommentId === item.data.id
																	? 'Unmark as answer'
																	: 'Mark as answer'}
															</DropdownMenuItem>
														) : null
													}
													isDeleting={commentDeleteMutation.isPending}
													isUpdating={commentUpdateMutation.isPending}
													onDelete={(commentId) => commentDeleteMutation.mutate({ _id: commentId })}
													onToggleEmote={(commentId, content) =>
														commentEmoteMutation.mutate({
															content,
															feedbackCommentId: commentId,
															feedbackId: feedback.id,
														})
													}
													onUpdate={(commentId, content) =>
														commentUpdateMutation.mutateAsync({
															_id: commentId,
															content,
														})
													}
													railClassName={
														feedback.answerCommentId === item.data.id
															? 'border-r-green-700 bg-linear-to-b from-green-400/20 via-green-400/10 to-transparent'
															: undefined
													}
												/>
											) : (
												<FeedbackEventItem event={item.data} />
											)}
											{item.id === middleButtonAnchorId ? middleCommentsButton : null}
										</Fragment>
									))}
								</ul>
							) : null}

							{auth.hasSession || auth.isAuthenticated ? (
								<CommentForm
									isAuthenticated
									isSubmitting={commentCreateMutation.isPending}
									onSubmit={handleCreateComment}
									placeholder='Leave a comment...'
									redirectTo={`/@${params.org}/${params.project}/feedback/${params.slug}`}
									submitLabel='Comment'
								/>
							) : auth.isLoading ? (
								<CommentAuthPending />
							) : (
								<CommentForm
									isAuthenticated={false}
									isSubmitting={commentCreateMutation.isPending}
									onSubmit={handleCreateComment}
									placeholder='Leave a comment...'
									redirectTo={`/@${params.org}/${params.project}/feedback/${params.slug}`}
									signedOut='rich'
									submitLabel='Comment'
								/>
							)}
						</CommentEditorProvider>
					</div>
				</div>
			</div>
		</div>
	);
}

function CommentBadge({ kind, label }: { kind: 'answer' | 'author' | 'team'; label: string }) {
	const Icon = kind === 'team' ? Users : Check;
	const className =
		kind === 'answer'
			? 'inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400'
			: kind === 'team'
				? 'inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
				: 'inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground';

	return (
		<span className={className}>
			<Icon className='h-3 w-3' />
			{label}
		</span>
	);
}

function CommentAuthPending() {
	return (
		<div className='mt-6 overflow-hidden rounded-lg border bg-card'>
			<div className='flex h-9 items-center gap-2 border-b px-3'>
				<Skeleton className='h-4 w-4' />
				<Skeleton className='h-4 w-4' />
				<Skeleton className='h-4 w-4' />
				<Skeleton className='h-4 w-4' />
				<Skeleton className='h-4 w-4' />
				<Skeleton className='h-4 w-4' />
			</div>
			<div className='px-4 py-4'>
				<Skeleton className='h-4 w-36' />
			</div>
			<div className='flex h-12 items-center justify-end border-t bg-muted/40 px-3'>
				<Skeleton className='h-8 w-20' />
			</div>
		</div>
	);
}

function FeedbackTargetDrawer({
	currentGranularity,
	currentTarget,
	feedbackId,
	isSaving,
	onOpenChange,
	onSave,
	open,
}: {
	currentGranularity: TargetGranularity | null;
	currentTarget: string | null;
	feedbackId: string;
	isSaving: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (
		value: {
			target: string;
			targetGranularity: TargetGranularity;
		} | null
	) => Promise<unknown>;
	open: boolean;
}) {
	const isMobile = useIsMobile();
	// Slide up from the bottom on mobile, in from the right on larger screens.
	const swipeDirection = isMobile ? 'down' : 'right';

	const initial = resolveInitialTargetState(currentTarget, currentGranularity);
	const [granularity, setGranularity] = useState<TargetGranularity>(initial.granularity);
	const [fields, setFields] = useState<TargetFields>(initial.fields);
	const [seedYear, setSeedYear] = useState(Number(initial.fields.year));
	const [slideFrom, setSlideFrom] = useState<'left' | 'right'>('right');
	const [error, setError] = useState('');

	// Only seed local edit state when the drawer transitions to open. Re-seeding on
	// every `currentTarget`/`currentGranularity` change would discard the user's
	// in-progress edits whenever the live Convex query re-emits the feedback doc.
	const wasOpen = useRef(false);
	useEffect(() => {
		if (open && !wasOpen.current) {
			const next = resolveInitialTargetState(currentTarget, currentGranularity);
			setGranularity(next.granularity);
			setFields(next.fields);
			setSeedYear(Number(next.fields.year));
			setSlideFrom('right');
			setError('');
		}
		wasOpen.current = open;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const yearNum = Number(fields.year);
	const monthNum = Number(fields.month);
	const yearOptions = useMemo(() => buildYearOptions(seedYear), [seedYear]);
	const dayOptions = useMemo(() => buildDayOptions(yearNum, monthNum), [yearNum, monthNum]);
	// The stored day can exceed the current month's length (e.g. picking day 31, then a
	// shorter month); clamp for display but keep `fields.day` so it restores on a longer month.
	const dayValue = pad2(Math.min(Math.max(Number(fields.day) || 1, 1), dayOptions.length));

	function updateFields(patch: Partial<TargetFields>) {
		setFields((prev) => ({ ...prev, ...patch }));
		setError('');
	}

	function handleGranularityChange(nextGranularity: TargetGranularity) {
		if (nextGranularity === granularity) return;
		const from = GRANULARITY_ORDER.indexOf(granularity);
		const to = GRANULARITY_ORDER.indexOf(nextGranularity);
		setSlideFrom(to > from ? 'right' : 'left');
		setGranularity(nextGranularity);
		setError('');
	}

	async function handleSave(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const nextTarget = targetTokenFromFields(granularity, fields);
		if (!isValidTarget(nextTarget, granularity)) {
			setError('Enter a valid target for the selected type.');
			return;
		}

		try {
			setError('');
			await onSave({ target: nextTarget, targetGranularity: granularity });
			onOpenChange(false);
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : 'Failed to save target');
		}
	}

	async function handleClear() {
		try {
			setError('');
			await onSave(null);
			onOpenChange(false);
		} catch (clearError) {
			setError(clearError instanceof Error ? clearError.message : 'Failed to clear target');
		}
	}

	const yearField = (
		<div className='flex min-w-0 flex-col gap-1.5'>
			<label className='text-xs font-medium text-muted-foreground' htmlFor='target-year'>
				Year
			</label>
			<Select
				items={yearOptions}
				onValueChange={(value) => updateFields({ year: String(value) })}
				value={fields.year}
			>
				<SelectTrigger className='h-10 w-full' id='target-year'>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{yearOptions.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);

	return (
		<Drawer
			onOpenChange={onOpenChange}
			open={open}
			showSwipeHandle={isMobile}
			swipeDirection={swipeDirection}
		>
			<DrawerContent className='rounded-xl border bg-card [--bleed:0px] [--drawer-bleed-background:var(--color-card)] [--drawer-inset:0.5rem] data-[swipe-axis=x]:sm:[--drawer-content-width:26rem]'>
				<DrawerHeader className='border-b bg-muted/40 px-5 py-4'>
					<div className='flex items-center gap-2.5 pr-8 text-left'>
						<span className='flex size-7 shrink-0 items-center justify-center rounded-md border bg-background text-primary shadow-xs'>
							<CalendarIcon className='size-3.5' />
						</span>
						<DrawerTitle className='text-sm font-semibold tracking-tight'>
							Edit target timeframe
						</DrawerTitle>
					</div>
					<DrawerDescription className='sr-only'>
						Target options for feedback {feedbackId}
					</DrawerDescription>
					<DrawerClose className='absolute top-3.5 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none'>
						<XIcon className='size-4' />
						<span className='sr-only'>Close</span>
					</DrawerClose>
				</DrawerHeader>

				<form className='flex min-h-0 flex-1 flex-col' onSubmit={handleSave}>
					{/* Granularity nav — the primary control, doubling as range navigation. */}
					<div className='border-b px-5 py-3'>
						<div className='grid grid-cols-4 gap-1 rounded-lg border bg-muted p-1'>
							{TARGET_GRANULARITY_OPTIONS.map((option) => (
								<button
									aria-pressed={granularity === option.value}
									className={cn(
										'h-8 rounded-md text-xs font-medium transition-all',
										granularity === option.value
											? 'bg-foreground text-background shadow-xs'
											: 'text-muted-foreground hover:text-foreground'
									)}
									key={option.value}
									onClick={() => handleGranularityChange(option.value)}
									type='button'
								>
									{option.label}
								</button>
							))}
						</div>
					</div>

					<div className='flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-5 py-5'>
						{/* Panel slides in from the direction the picked range sits in the nav. */}
						<div
							className={cn(
								'animate-in duration-200 fade-in-0',
								slideFrom === 'right' ? 'slide-in-from-right-6' : 'slide-in-from-left-6'
							)}
							key={granularity}
						>
							{granularity === 'day' ? (
								<div className='grid grid-cols-3 gap-3'>
									<div className='flex min-w-0 flex-col gap-1.5'>
										<label
											className='text-xs font-medium text-muted-foreground'
											htmlFor='target-day'
										>
											Day
										</label>
										<Select
											items={dayOptions}
											onValueChange={(value) => updateFields({ day: String(value) })}
											value={dayValue}
										>
											<SelectTrigger className='h-10 w-full' id='target-day'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{dayOptions.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className='flex min-w-0 flex-col gap-1.5'>
										<label
											className='text-xs font-medium text-muted-foreground'
											htmlFor='target-day-month'
										>
											Month
										</label>
										<Select
											items={MONTH_OPTIONS}
											onValueChange={(value) => updateFields({ month: String(value) })}
											value={fields.month}
										>
											<SelectTrigger className='h-10 w-full' id='target-day-month'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{MONTH_OPTIONS.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									{yearField}
								</div>
							) : null}

							{granularity === 'month' ? (
								<div className='grid grid-cols-2 gap-3'>
									<div className='flex min-w-0 flex-col gap-1.5'>
										<label
											className='text-xs font-medium text-muted-foreground'
											htmlFor='target-month'
										>
											Month
										</label>
										<Select
											items={MONTH_OPTIONS}
											onValueChange={(value) => updateFields({ month: String(value) })}
											value={fields.month}
										>
											<SelectTrigger className='h-10 w-full' id='target-month'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{MONTH_OPTIONS.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									{yearField}
								</div>
							) : null}

							{granularity === 'quarter' ? (
								<div className='grid grid-cols-2 gap-3'>
									<div className='flex min-w-0 flex-col gap-1.5'>
										<label
											className='text-xs font-medium text-muted-foreground'
											htmlFor='target-quarter'
										>
											Quarter
										</label>
										<Select
											items={QUARTER_OPTIONS}
											onValueChange={(value) => updateFields({ quarter: String(value) })}
											value={fields.quarter}
										>
											<SelectTrigger className='h-10 w-full' id='target-quarter'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{QUARTER_OPTIONS.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									{yearField}
								</div>
							) : null}

							{granularity === 'year' ? yearField : null}
						</div>

						{error ? (
							<p className='rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
								{error}
							</p>
						) : null}
					</div>

					<DrawerFooter className='border-t bg-muted/40 px-5 py-3'>
						<div className='flex flex-row items-center justify-between gap-2'>
							<Button
								disabled={isSaving}
								onClick={handleClear}
								size='sm'
								type='button'
								variant='ghost'
							>
								Clear
							</Button>
							<div className='flex flex-row gap-2'>
								<Button
									disabled={isSaving}
									onClick={() => onOpenChange(false)}
									size='sm'
									type='button'
									variant='outline'
								>
									Cancel
								</Button>
								<Button disabled={isSaving} size='sm' type='submit'>
									{isSaving ? 'Saving...' : 'Save target'}
								</Button>
							</div>
						</div>
					</DrawerFooter>
				</form>
			</DrawerContent>
		</Drawer>
	);
}

function InlineFeedbackTitleEditor({
	canEdit,
	isSaving,
	onSave,
	reserveEditGeometry = false,
	title,
}: {
	canEdit: boolean;
	isSaving: boolean;
	onSave: (title: string) => Promise<unknown>;
	reserveEditGeometry?: boolean;
	title: string;
}) {
	const editorRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [editing, setEditing] = useState(false);
	const [draftTitle, setDraftTitle] = useState(title);
	const [error, setError] = useState('');
	const [mobileEditorTop, setMobileEditorTop] = useState(0);
	const trimmedDraftTitle = draftTitle.trim();
	const hasEdits = draftTitle !== title;
	const canSave =
		trimmedDraftTitle.length > 0 &&
		trimmedDraftTitle.length <= FORM_LIMITS.feedbackTitle &&
		trimmedDraftTitle !== title &&
		!isSaving;

	useEffect(() => {
		if (!editing) return;

		window.setTimeout(() => {
			const titleField = textareaRef.current ?? inputRef.current;
			titleField?.focus();
			titleField?.select();
		}, 0);
	}, [editing]);

	useEffect(() => {
		if (!editing) return;

		function updateMobileEditorPosition() {
			const rect = editorRef.current?.getBoundingClientRect();
			if (!rect) return;
			setMobileEditorTop(Math.max(16, rect.top - 8));
		}

		updateMobileEditorPosition();
		window.addEventListener('resize', updateMobileEditorPosition);
		window.addEventListener('scroll', updateMobileEditorPosition, true);

		return () => {
			window.removeEventListener('resize', updateMobileEditorPosition);
			window.removeEventListener('scroll', updateMobileEditorPosition, true);
		};
	}, [editing]);

	function startEditing() {
		if (!canEdit) return;

		setDraftTitle(title);
		setError('');
		setEditing(true);
	}

	function closeEditor() {
		setEditing(false);
		setError('');
		setDraftTitle(title);
	}

	function requestClose() {
		if (!hasEdits) {
			closeEditor();
			return;
		}

		if (window.confirm('You have unsaved title changes. Discard them and close the editor?')) {
			closeEditor();
			return;
		}

		const titleField = textareaRef.current ?? inputRef.current;
		titleField?.focus();
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!canSave) return;

		setError('');
		if (trimmedDraftTitle.length > FORM_LIMITS.feedbackTitle) {
			setError(`Titles must be ${FORM_LIMITS.feedbackTitle} characters or fewer.`);
			return;
		}
		try {
			await onSave(trimmedDraftTitle);
			closeEditor();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unable to save title');
		}
	}

	function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
		if (event.key === 'Escape') {
			event.preventDefault();
			requestClose();
			return;
		}
		if (event.key === 'Enter' && event.metaKey) {
			event.preventDefault();
			event.currentTarget.form?.requestSubmit();
		}
	}

	const mobileEditorStyle = {
		position: 'fixed',
		top: mobileEditorTop,
		left: 16,
		right: 16,
	} as CSSProperties;

	if (!canEdit && !reserveEditGeometry) {
		return <h1 className='text-3xl'>{title}</h1>;
	}

	if (!canEdit) {
		return (
			<div className='relative -mx-2 w-full px-2' ref={editorRef}>
				<h1 className='min-w-0 text-3xl'>{title}</h1>
			</div>
		);
	}

	return (
		<div className='group/title relative -mx-2 w-full px-2' ref={editorRef}>
			<div
				aria-hidden={editing}
				className={cn('flex items-start gap-1.5', editing && 'pointer-events-none invisible')}
			>
				<h1 className='min-w-0 text-3xl'>{title}</h1>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							aria-label='Edit title'
							className='mt-0.5 size-8 opacity-0 transition-opacity group-hover/title:opacity-100 focus-visible:opacity-100'
							onClick={startEditing}
							size='icon'
							type='button'
							variant='ghost'
						>
							<EditIcon className='size-4' />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Edit title</TooltipContent>
				</Tooltip>
			</div>

			{editing ? (
				<>
					<button
						aria-label='Close title editor'
						className='fixed inset-0 z-40 cursor-default bg-black/45'
						onMouseDown={(event) => {
							event.preventDefault();
							requestClose();
						}}
						type='button'
					/>
					<form
						className='fixed z-50 flex min-w-0 flex-col items-stretch gap-3 rounded-lg border bg-background p-3 shadow-2xl md:hidden'
						onMouseDown={(event) => event.stopPropagation()}
						onSubmit={handleSubmit}
						style={mobileEditorStyle}
					>
						<div className='min-w-0 flex-1'>
							<Textarea
								aria-label='Feedback title'
								className='min-h-32 resize-none rounded-none border-0 bg-transparent px-0 py-0 text-3xl leading-tight shadow-none focus-visible:ring-0'
								disabled={isSaving}
								onChange={(event) => {
									setDraftTitle(event.target.value);
									setError('');
								}}
								onKeyDown={handleTitleKeyDown}
								ref={textareaRef}
								value={draftTitle}
							/>
							{error ? <p className='mt-2 text-sm text-destructive'>{error}</p> : null}
						</div>
						<Button className='w-full' disabled={!canSave} type='submit'>
							<Check className='size-4' />
							Save
						</Button>
					</form>
					<form
						className='absolute -top-2 -right-36 -left-2 z-50 hidden min-w-0 items-start gap-2 rounded-lg border bg-background p-2 shadow-2xl md:flex'
						onMouseDown={(event) => event.stopPropagation()}
						onSubmit={handleSubmit}
					>
						<div className='min-w-0 flex-1'>
							<Input
								aria-label='Feedback title'
								className='h-auto rounded-none border-0 bg-transparent px-0 py-0 text-3xl shadow-none focus-visible:ring-0 md:text-3xl'
								disabled={isSaving}
								onChange={(event) => {
									setDraftTitle(event.target.value);
									setError('');
								}}
								onKeyDown={handleTitleKeyDown}
								ref={inputRef}
								value={draftTitle}
							/>
							{error ? <p className='mt-2 text-sm text-destructive'>{error}</p> : null}
						</div>
						<Button disabled={!canSave} type='submit'>
							<Check className='size-4' />
							Save
						</Button>
					</form>
				</>
			) : null}
		</div>
	);
}
