import type { TargetGranularity } from '@convex/target';
import type { FormEvent } from 'react';
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
	CircleSlash,
	ExternalLink,
	GitBranch,
	Info,
	Link as LinkIcon,
	MessageSquare,
	Plus,
	Tag,
	Trash2,
	Users,
} from 'lucide-react';

import { BoardIcon } from '@/components/board-icon';
import { Field } from '@/components/field';
import { ProfileLinkOrUnknown } from '@/components/profile-link';
import { SidebarSection } from '@/components/sidebar-section';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
	ResponsiveDialog,
	ResponsiveDialogBody,
	ResponsiveDialogContent,
	ResponsiveDialogFooter,
	ResponsiveDialogHeader,
} from '@/components/ui/responsive-dialog';
import {
	ResponsiveSideDrawer,
	ResponsiveSideDrawerBody,
	ResponsiveSideDrawerContent,
	ResponsiveSideDrawerFooter,
	ResponsiveSideDrawerHeader,
	ResponsiveSideDrawerTrigger,
} from '@/components/ui/responsive-side-drawer';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EditIcon, StatusIcon, UpChevronIcon } from '@/icons';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { localizeError } from '@/lib/errors';
import { useIsBelow } from '@/lib/hooks/use-mobile';
import { useSidebarState } from '@/lib/hooks/use-sidebar-state';
import { projectTitle, titleFromSlug, titleMeta } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { formatTimestamp, toTimestamp } from '@/lib/utils/format-timestamp';
import { FORM_LIMITS } from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

import { SignInPromptDialog } from '../-components/sign-in-prompt-dialog';
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
	{ label: m.feedback_status_open, value: 'open' },
	{ label: m.feedback_status_in_progress, value: 'in-progress' },
	{ label: m.feedback_status_paused, value: 'paused' },
	{ label: m.feedback_status_completed, value: 'completed' },
	{ label: m.feedback_status_closed, value: 'closed' },
] as const;

const FEEDBACK_PRIORITY_OPTIONS = [
	{ dotClass: 'bg-muted-foreground/40', label: m.feedback_priority_none, value: 'none' },
	{ dotClass: 'bg-sky-500', label: m.feedback_priority_low, value: 'low' },
	{ dotClass: 'bg-amber-500', label: m.feedback_priority_medium, value: 'medium' },
	{ dotClass: 'bg-orange-500', label: m.feedback_priority_high, value: 'high' },
	{ dotClass: 'bg-red-500', label: m.feedback_priority_urgent, value: 'urgent' },
] as const;

const TARGET_GRANULARITY_OPTIONS: Array<{
	label: () => string;
	value: TargetGranularity;
}> = [
	{ label: m.feedback_target_day, value: 'day' },
	{ label: m.feedback_target_month, value: 'month' },
	{ label: m.feedback_target_quarter, value: 'quarter' },
	{ label: m.feedback_target_year, value: 'year' },
];

const QUARTER_OPTIONS = [
	{ label: m.feedback_quarter_1, value: 'Q1' },
	{ label: m.feedback_quarter_2, value: 'Q2' },
	{ label: m.feedback_quarter_3, value: 'Q3' },
	{ label: m.feedback_quarter_4, value: 'Q4' },
] as const;

const MONTH_OPTIONS = [
	{ label: m.feedback_month_january, value: '01' },
	{ label: m.feedback_month_february, value: '02' },
	{ label: m.feedback_month_march, value: '03' },
	{ label: m.feedback_month_april, value: '04' },
	{ label: m.feedback_month_may, value: '05' },
	{ label: m.feedback_month_june, value: '06' },
	{ label: m.feedback_month_july, value: '07' },
	{ label: m.feedback_month_august, value: '08' },
	{ label: m.feedback_month_september, value: '09' },
	{ label: m.feedback_month_october, value: '10' },
	{ label: m.feedback_month_november, value: '11' },
	{ label: m.feedback_month_december, value: '12' },
] as const;

// How far the granularity nav slides its panel in; index order mirrors the nav (L→R).
const GRANULARITY_ORDER: Array<TargetGranularity> = ['day', 'month', 'quarter', 'year'];

function formatFeedbackTarget(
	target: string | null | undefined,
	granularity: TargetGranularity | null | undefined
) {
	if (!target || !granularity || !isValidTarget(target, granularity)) {
		return m.feedback_unscheduled();
	}
	return formatTargetOrUnscheduled(target, granularity);
}

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
	const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
	const [targetDrawerOpen, setTargetDrawerOpen] = useState(false);
	const [editTitleOpen, setEditTitleOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [closeOpen, setCloseOpen] = useState(false);
	const [metadataDrawerOpen, setMetadataDrawerOpen] = useState(false);
	// The metadata drawer only exists below `lg`; close it if the viewport grows to
	// desktop so it doesn't linger open (and pop back in on a resize down).
	const isBelowLg = useIsBelow(1024);
	useEffect(() => {
		if (!isBelowLg) setMetadataDrawerOpen(false);
	}, [isBelowLg]);
	const [authPromptOpen, setAuthPromptOpen] = useState(false);
	// Retained across close so the dialog copy doesn't flash while it animates out.
	const [authPromptAction, setAuthPromptAction] = useState<'follow' | 'react' | 'upvote'>('upvote');
	// Reveal the sticky title bar once the page header has scrolled out of view.
	const headerRef = useRef<HTMLDivElement>(null);
	const [showStickyBar, setShowStickyBar] = useState(false);
	useEffect(() => {
		const el = headerRef.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			([entry]) => setShowStickyBar(!entry.isIntersecting),
			{ threshold: 0 }
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	function scrollToTop() {
		window.scrollTo({ behavior: 'smooth', top: 0 });
	}
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
			{ enabled: !!projectData.permissions.canManageContent, skipUnauth: true }
		)
	);

	const currentProfile = interactiveQuery.data?.currentProfile;
	const assignedProfile = interactiveQuery.data?.assignedProfile;
	const isAuthenticated = auth.hasSession || auth.isAuthenticated;
	const canEditStatus =
		feedback.authorProfileId === currentProfile?.id || projectData.permissions.canManageContent;
	// Priority is assigned-moderator/admin-only — the feedback author cannot change it.
	const canEditPriority = projectData.permissions.canManageContent;
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
				{status.label()}
			</span>
		),
		value: status.value,
	}));
	const prioritySelectItems = FEEDBACK_PRIORITY_OPTIONS.map((priority) => ({
		label: (
			<span className='inline-flex items-center gap-1.5'>
				<span className={`size-2 rounded-full ${priority.dotClass}`} />
				{priority.label()}
			</span>
		),
		value: priority.value,
	}));
	const boardSelectItems = boardOptions.map((board: { id: string; name: string }) => ({
		label: board.name,
		value: board.id,
	}));
	const assigneeSelectItems = [
		{ label: m.feedback_unassigned(), value: '' },
		...assigneeOptions.map((member: { profile?: ProfileSummary | null; profileId: string }) => ({
			label: member.profile?.name ?? member.profile?.username ?? m.feedback_unknown(),
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
			onSuccess: () => {
				navigate({
					params: { org: params.org, project: params.project },
					to: '/@{$org}/$project/feedback',
				});
			},
		})
	);

	const visibleGithubConnections = githubConnectionsQuery.data ?? [];
	const showGithubConnectionsSection =
		projectData.permissions.canManageContent || visibleGithubConnections.length > 0;

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
		if (!projectData.permissions.canManageContent) return;
		if (visibleGithubConnections.length === 0) return;
		if (refreshGithubConnectionsMutation.isPending) return;

		// `listByFeedback` is a live subscription — refreshing the counts
		// server-side pushes the new data, so no manual refetch is needed.
		refreshGithubConnectionsMutation.mutate({ feedbackId: feedback.id });
		// `refreshGithubConnectionsMutation` is a mutation object (unstable ref);
		// key this off the feedback/connection state, not the mutation identity.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [feedback.id, visibleGithubConnections.length, projectData.permissions.canManageContent]);

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
				{isLoadingMiddleComments ? m.feedback_loading_comments() : m.feedback_show_more_comments()}
			</Button>
		</li>
	) : null;

	// Upvote + Follow. Rendered in two places (sidebar on desktop, above the
	// discussion on mobile) and toggled with breakpoint classes on the wrappers.
	const actionButtons = (
		<>
			<UpvoteButton
				className='lg:flex-1'
				feedbackId={feedback.id}
				initialCount={feedback.upvotes}
				initialHasUpvoted={interactiveQuery.data?.hasUpvoted ?? false}
				inline
				isAuthenticated={isAuthenticated}
				onUnauthenticated={() => {
					setAuthPromptAction('upvote');
					setAuthPromptOpen(true);
				}}
			/>
			<Button
				className='lg:flex-1'
				onClick={() => {
					if (!isAuthenticated) {
						setAuthPromptAction('follow');
						setAuthPromptOpen(true);
					}
				}}
				size='lg'
				type='button'
				variant='outline'
			>
				<Bell className='size-4' />
				{m.feedback_follow()}
			</Button>
		</>
	);

	const sidebarSections = (
		<>
			<SidebarSection
				icon={<Info className='size-3.5' />}
				onOpenChange={(open) => setSidebarSection('details', open)}
				open={sidebarState.details}
				title={m.feedback_details()}
			>
				<div className='flex flex-col'>
					<div className='flex items-center justify-between py-1.5'>
						<span className='text-sm text-muted-foreground'>{m.feedback_status()}</span>
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
											{status.label()}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : (
							<span className='inline-flex items-center gap-1.5 text-sm'>
								<StatusIcon colored size='14' status={feedback.status} />
								{FEEDBACK_STATUS_OPTIONS.find((status) => status.value === feedback.status)
									?.label ?? feedback.status}
							</span>
						)}
					</div>

					<div className='flex items-center justify-between py-1.5'>
						<span className='text-sm text-muted-foreground'>{m.feedback_board()}</span>
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
									<SelectValue placeholder={m.feedback_no_board()} />
								</SelectTrigger>
								<SelectContent>
									{boardOptions.map((board: { id: string; name: string }) => (
										<SelectItem key={board.id} value={board.id}>
											{board.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : (
							<span
								className={cn(
									'inline-flex items-center gap-1.5 text-sm',
									!feedbackData.board && 'text-muted-foreground'
								)}
							>
								{feedbackData.board ? (
									<BoardIcon
										icon={feedbackData.board.icon}
										name={feedbackData.board.name}
										size='14px'
									/>
								) : null}
								{feedbackData.board?.name ?? m.feedback_no_board()}
							</span>
						)}
					</div>

					<div className='flex items-center justify-between py-1.5'>
						<span className='text-sm text-muted-foreground'>{m.feedback_priority()}</span>
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
											{priority.label()}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : (
							<span
								className={cn(
									'inline-flex items-center gap-1.5 text-sm capitalize',
									(feedback.priority ?? 'none') === 'none' && 'text-muted-foreground'
								)}
							>
								<span
									className={`size-2 rounded-full ${
										FEEDBACK_PRIORITY_OPTIONS.find(
											(option) => option.value === (feedback.priority ?? 'none')
										)?.dotClass ?? 'bg-muted-foreground/40'
									}`}
								/>
								{FEEDBACK_PRIORITY_OPTIONS.find(
									(option) => option.value === (feedback.priority ?? 'none')
								)?.label() ?? feedback.priority}
							</span>
						)}
					</div>

					<div className='flex items-center justify-between py-1.5'>
						<span className='text-sm text-muted-foreground'>{m.feedback_target()}</span>
						{projectData.permissions.canManageContent ? (
							<Button
								className='max-w-52 justify-end'
								onClick={() => setTargetDrawerOpen(true)}
								size='default'
								type='button'
								variant='secondary'
							>
								<CalendarIcon className='size-3.5' />
								<span className='truncate'>
									{formatFeedbackTarget(
										feedback.target ?? null,
										feedback.targetGranularity ?? null
									)}
								</span>
							</Button>
						) : (
							<span
								className={cn(
									'max-w-52 truncate text-sm',
									!feedback.target && 'text-muted-foreground'
								)}
							>
								{formatFeedbackTarget(feedback.target ?? null, feedback.targetGranularity ?? null)}
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
					title={m.feedback_connections()}
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
							<p className='py-2 text-sm text-muted-foreground'>{m.feedback_no_github_items()}</p>
						)}
						{projectData.permissions.canManageContent ? (
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
				title={m.feedback_people()}
			>
				<div className='flex flex-col'>
					<div className='flex items-center justify-between py-1.5'>
						<span className='text-sm text-muted-foreground'>{m.feedback_assignee()}</span>
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
									<SelectValue placeholder={m.feedback_unassigned()} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value=''>{m.feedback_unassigned()}</SelectItem>
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
							<span className={cn('text-sm', !assignedProfile && 'text-muted-foreground')}>
								{assignedProfile?.name ?? assignedProfile?.username ?? m.feedback_unassigned()}
							</span>
						)}
					</div>
					<div className='flex items-center justify-between py-1.5'>
						<span className='text-sm text-muted-foreground'>{m.feedback_author()}</span>
						<ProfileLinkOrUnknown profile={feedbackData.author} display='name' />
					</div>
					<div className='flex items-center justify-between py-1.5'>
						<span className='text-sm text-muted-foreground'>{m.feedback_watchers()}</span>
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
				title={m.feedback_labels()}
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
						{m.common_add()}
					</Button>
				</div>
			</SidebarSection>

			<SidebarSection
				icon={<LinkIcon className='size-3.5' />}
				onOpenChange={(open) => setSidebarSection('related', open)}
				open={sidebarState.related}
				title={m.feedback_related()}
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
						{m.feedback_link_related()}
					</Link>
				</div>
			</SidebarSection>
		</>
	);

	// Close/Delete buttons only (no wrapper) so each place can frame them: a
	// `border-t` group in the desktop sidebar, the drawer footer on tablet/mobile.
	// `null` when the viewer can't manage the feedback.
	const closeDeleteButtons =
		isAuthenticated && canEditStatus ? (
			<>
				<Button
					className='flex-1'
					disabled={feedback.status === 'closed' || feedback.status === 'completed'}
					onClick={() => setCloseOpen(true)}
					type='button'
					variant='outline'
				>
					<CircleSlash className='size-4' />
					{m.common_close()}
				</Button>
				{projectData.permissions.canManageContent ? (
					<Button
						className='flex-1'
						onClick={() => setDeleteOpen(true)}
						type='button'
						variant='outline'
					>
						<Trash2 className='size-4' />
						{m.common_delete()}
					</Button>
				) : null}
			</>
		) : null;

	return (
		<div className='flex flex-1 flex-col'>
			<EditTitleDialog
				currentTitle={feedback.title}
				isSaving={titleMutation.isPending}
				onOpenChange={setEditTitleOpen}
				onSave={(title) => titleMutation.mutateAsync({ id: feedback.id, title })}
				open={editTitleOpen}
			/>
			<DeleteFeedbackDialog
				isDeleting={deleteMutation.isPending}
				onDelete={() => deleteMutation.mutateAsync({ id: feedback.id })}
				onOpenChange={setDeleteOpen}
				open={deleteOpen}
			/>
			<CloseFeedbackDialog
				isClosing={statusMutation.isPending}
				onClose={() => statusMutation.mutateAsync({ id: feedback.id, status: 'closed' })}
				onOpenChange={setCloseOpen}
				open={closeOpen}
			/>
			<SignInPromptDialog
				action={authPromptAction}
				onOpenChange={setAuthPromptOpen}
				open={authPromptOpen}
			/>
			<GitHubConnectionDialog
				feedbackId={feedback.id}
				open={connectionDialogOpen}
				onOpenChange={setConnectionDialogOpen}
				orgSlug={params.org}
				projectSlug={params.project}
			/>
			<FeedbackTargetDrawer
				currentGranularity={feedback.targetGranularity ?? null}
				currentTarget={feedback.target ?? null}
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
			<div className='border-b' ref={headerRef}>
				<div className='container flex items-start gap-4 pt-10 pb-6 [--max-width:52rem] lg:[--max-width:75rem]'>
					<div className='mt-1'>
						<StatusIcon colored size='28' status={feedback.status} />
					</div>
					<div className='flex flex-1 flex-col gap-2'>
						{canEditStatus ? (
							// Desktop: the title itself is the edit affordance — hovering
							// reveals a muted background + ring that zooms in slightly. Inert
							// on mobile (`max-md:pointer-events-none`); mobile uses the link
							// in the subtitle below instead.
							<Tooltip>
								<TooltipTrigger
									className='group relative -mx-3 -my-1.5 flex cursor-pointer rounded-lg px-3 py-1.5 text-left max-md:pointer-events-none'
									onClick={() => setEditTitleOpen(true)}
									type='button'
								>
									{/* Always-present bg + ring layer. It fades and grows in on hover
									    (opacity 0→100, scale 95→100) so nothing about the text's
									    layout ever changes — no shift. */}
									<span
										aria-hidden
										className='pointer-events-none absolute inset-0 scale-95 rounded-lg bg-accent opacity-0 ring-1 ring-accent transition-all duration-200 md:group-hover:scale-100 md:group-hover:opacity-100'
									/>
									<h1 className='relative text-xl md:text-3xl'>{feedback.title}</h1>
								</TooltipTrigger>
								{/* Left-aligned, nudged a few px in from the title's left edge. */}
								<TooltipContent align='start' alignOffset={12}>
									{m.feedback_click_to_edit()}
								</TooltipContent>
							</Tooltip>
						) : (
							<h1 className='text-xl md:text-3xl'>{feedback.title}</h1>
						)}
						<div className='text-sm text-muted-foreground'>
							<span suppressHydrationWarning>
								{feedback.status === 'open' ? m.feedback_opened() : m.feedback_updated()}{' '}
								{formatTimestamp(toTimestamp(feedback.createdAt))} · {feedback.upvotes}{' '}
								{m.feedback_upvote_count({ count: feedback.upvotes })}
							</span>
							{canEditStatus ? (
								<span className='md:hidden'>
									{' · '}
									<button
										className='font-medium text-foreground underline underline-offset-2'
										onClick={() => setEditTitleOpen(true)}
										type='button'
									>
										{m.feedback_edit_title()}
									</button>
								</span>
							) : null}
						</div>
					</div>
				</div>
			</div>
			<div className='container flex flex-1 flex-col [--max-width:52rem] lg:[--max-width:75rem]'>
				<div className='flex flex-1 flex-col gap-6 lg:grid lg:grid-cols-12 lg:gap-8'>
					<div className='hidden lg:order-last lg:col-span-4 lg:block lg:border-l lg:border-border/75 lg:py-8'>
						<div className='flex flex-col gap-6 lg:sticky lg:top-4 lg:pl-8'>
							<div className='hidden gap-2 lg:flex'>{actionButtons}</div>
							{sidebarSections}
							{closeDeleteButtons ? (
								<div className='flex items-center gap-2 border-t pt-4'>{closeDeleteButtons}</div>
							) : null}
						</div>
					</div>

					<div className='flex flex-col gap-6 lg:col-span-8 lg:block'>
						<div className='sticky top-0 isolate z-20 h-0'>
							{/* Outer = the bar surface: full-browser-width below `lg` (full-bleed
							    via the 50%/50vw trick), constrained to the column + reaching the
							    sidebar border at `lg`. Inner keeps the content aligned with the
							    centered column width. */}
							<div
								className={cn(
									'border-b bg-background/80 backdrop-blur-md transition-all duration-200 max-lg:mx-[calc(50%-50vw)] lg:-mr-8',
									showStickyBar ? 'opacity-100' : 'pointer-events-none -translate-y-1 opacity-0'
								)}
							>
								<div className='group relative mx-auto flex w-full max-w-(--max-width) items-center gap-3 overflow-hidden py-3 pr-4 pl-6 lg:max-w-none lg:pr-0'>
									<StatusIcon colored size='20' status={feedback.status} />
									<button
										className='link min-w-0 flex-1 overflow-hidden text-left text-sm font-semibold whitespace-nowrap text-muted-foreground md:text-base'
										onClick={scrollToTop}
										type='button'
									>
										{feedback.title}
									</button>
									<div
										aria-hidden
										className='pointer-events-none absolute inset-y-0 right-0 w-40 bg-gradient-to-r from-transparent to-background'
									/>
									{/* Up chevron fades in on hover, hinting the title scrolls to top. */}
									<UpChevronIcon
										className='pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100'
										size='20'
									/>
								</div>
							</div>
						</div>
						<div className='flex items-center gap-2 lg:hidden'>
							{actionButtons}
							<ResponsiveSideDrawer onOpenChange={setMetadataDrawerOpen} open={metadataDrawerOpen}>
								<ResponsiveSideDrawerTrigger
									render={<Button className='ml-auto' size='lg' variant='outline' />}
								>
									<Info className='size-4' />
									{m.feedback_details()}
								</ResponsiveSideDrawerTrigger>
								<ResponsiveSideDrawerContent>
									<ResponsiveSideDrawerHeader icon={<Info />} title={m.feedback_details()} />
									<ResponsiveSideDrawerBody className='flex flex-col gap-6'>
										{sidebarSections}
									</ResponsiveSideDrawerBody>
									{closeDeleteButtons ? (
										<ResponsiveSideDrawerFooter>{closeDeleteButtons}</ResponsiveSideDrawerFooter>
									) : null}
								</ResponsiveSideDrawerContent>
							</ResponsiveSideDrawer>
						</div>
						<div className='flex flex-col gap-4 py-8'>
							<div className='flex w-full items-center border-b pb-2'>
								<h2 className='flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
									<MessageSquare className='size-3.5' />
									{m.feedback_discussion()}
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
														<CommentBadge kind='author' label={m.feedback_author()} />
														{firstComment.isTeamMember ? (
															<CommentBadge kind='team' label={m.feedback_team()} />
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
												onUnauthenticated={() => {
													setAuthPromptAction('react');
													setAuthPromptOpen(true);
												}}
												onUpdate={(commentId, content) =>
													commentUpdateMutation.mutateAsync({
														_id: commentId,
														content,
													})
												}
												verb={m.feedback_opened_this_feedback()}
											/>
										) : null}
										{!middleButtonAnchorId ? middleCommentsButton : null}
										{timelineItems.map((item, index) => (
											<Fragment key={`${item.type}:${item.id}`}>
												{item.type === 'comment' ? (
													<CommentCard
														badges={
															<>
																{item.data.author?.id === feedback.authorProfileId ? (
																	<CommentBadge kind='author' label={m.feedback_author()} />
																) : null}
																{item.data.isTeamMember ? (
																	<CommentBadge kind='team' label={m.feedback_team()} />
																) : null}
																{feedback.answerCommentId === item.data.id ? (
																	<CommentBadge kind='answer' label={m.feedback_answer()} />
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
																		? m.feedback_unmark_answer()
																		: m.feedback_mark_answer()}
																</DropdownMenuItem>
															) : null
														}
														isDeleting={commentDeleteMutation.isPending}
														isUpdating={commentUpdateMutation.isPending}
														onDelete={(commentId) =>
															commentDeleteMutation.mutate({ _id: commentId })
														}
														onToggleEmote={(commentId, content) =>
															commentEmoteMutation.mutate({
																content,
																feedbackCommentId: commentId,
																feedbackId: feedback.id,
															})
														}
														onUnauthenticated={() => {
															setAuthPromptAction('react');
															setAuthPromptOpen(true);
														}}
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
													<FeedbackEventItem
														event={item.data}
														isLast={index === timelineItems.length - 1}
													/>
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
										placeholder={m.feedback_leave_comment()}
										redirectTo={`/@${params.org}/${params.project}/feedback/${params.slug}`}
										submitLabel={m.feedback_comment()}
									/>
								) : auth.isLoading ? (
									<CommentAuthPending />
								) : (
									<CommentForm
										isAuthenticated={false}
										isSubmitting={commentCreateMutation.isPending}
										onSubmit={handleCreateComment}
										placeholder={m.feedback_leave_comment()}
										redirectTo={`/@${params.org}/${params.project}/feedback/${params.slug}`}
										signedOut='rich'
										submitLabel={m.feedback_comment()}
									/>
								)}
							</CommentEditorProvider>
						</div>
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
	isSaving,
	onOpenChange,
	onSave,
	open,
}: {
	currentGranularity: TargetGranularity | null;
	currentTarget: string | null;
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
	const monthOptions = MONTH_OPTIONS.map((option) => ({ ...option, label: option.label() }));
	const quarterOptions = QUARTER_OPTIONS.map((option) => ({ ...option, label: option.label() }));
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
			setError(m.feedback_target_invalid());
			return;
		}

		try {
			setError('');
			await onSave({ target: nextTarget, targetGranularity: granularity });
			onOpenChange(false);
		} catch (saveError) {
			setError(localizeError(saveError, m.feedback_target_save_failed()));
		}
	}

	async function handleClear() {
		try {
			setError('');
			await onSave(null);
			onOpenChange(false);
		} catch (clearError) {
			setError(localizeError(clearError, m.feedback_target_clear_failed()));
		}
	}

	const yearField = (
		<div className='flex min-w-0 flex-col gap-1.5'>
			<label className='text-xs font-medium text-muted-foreground' htmlFor='target-year'>
				{m.feedback_target_year()}
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
		<ResponsiveDialog onOpenChange={onOpenChange} open={open}>
			<ResponsiveDialogContent
				className='flex flex-col gap-0 overflow-hidden p-0'
				dialogClassName='max-h-[85vh] sm:max-w-md'
				showCloseButton={false}
			>
				<ResponsiveDialogHeader icon={<CalendarIcon />} title={m.feedback_edit_target()} />

				<form className='flex min-h-0 flex-1 flex-col' onSubmit={handleSave}>
					{/* Granularity nav — the primary control, doubling as range navigation.
					    Official Tabs for tablist semantics + keyboard nav; the sliding
					    indicator mirrors the directional slide of the panel below. */}
					<div className='border-b px-5 py-3'>
						<Tabs
							onValueChange={(value) => handleGranularityChange(value as TargetGranularity)}
							value={granularity}
						>
							<TabsList
								className='grid h-auto w-full grid-cols-4 gap-1 rounded-lg border bg-muted p-1'
								indicatorClassName='h-[calc(var(--active-tab-height)-0.25rem)] bg-foreground shadow-xs ring-0'
							>
								{TARGET_GRANULARITY_OPTIONS.map((option) => (
									<TabsTrigger
										className='h-8 rounded-md text-xs data-active:text-background'
										key={option.value}
										value={option.value}
									>
										{option.label()}
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
					</div>

					<div className='flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-5 py-3 md:py-5'>
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
											{m.feedback_target_day()}
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
											{m.feedback_target_month()}
										</label>
										<Select
											items={monthOptions}
											onValueChange={(value) => updateFields({ month: String(value) })}
											value={fields.month}
										>
											<SelectTrigger className='h-10 w-full' id='target-day-month'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{monthOptions.map((option) => (
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
											{m.feedback_target_month()}
										</label>
										<Select
											items={monthOptions}
											onValueChange={(value) => updateFields({ month: String(value) })}
											value={fields.month}
										>
											<SelectTrigger className='h-10 w-full' id='target-month'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{monthOptions.map((option) => (
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
											{m.feedback_target_quarter()}
										</label>
										<Select
											items={quarterOptions}
											onValueChange={(value) => updateFields({ quarter: String(value) })}
											value={fields.quarter}
										>
											<SelectTrigger className='h-10 w-full' id='target-quarter'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{quarterOptions.map((option) => (
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

					<ResponsiveDialogFooter className='justify-between'>
						<Button
							disabled={isSaving}
							onClick={handleClear}
							size='sm'
							type='button'
							variant='ghost'
						>
							{m.common_clear()}
						</Button>
						<div className='flex flex-row gap-2'>
							<Button
								disabled={isSaving}
								onClick={() => onOpenChange(false)}
								size='sm'
								type='button'
								variant='outline'
							>
								{m.common_cancel()}
							</Button>
							<Button disabled={isSaving} size='sm' type='submit'>
								{isSaving ? m.common_saving() : m.feedback_save_target()}
							</Button>
						</div>
					</ResponsiveDialogFooter>
				</form>
			</ResponsiveDialogContent>
		</ResponsiveDialog>
	);
}

function EditTitleDialog({
	currentTitle,
	isSaving,
	onOpenChange,
	onSave,
	open,
}: {
	currentTitle: string;
	isSaving: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (title: string) => Promise<unknown>;
	open: boolean;
}) {
	const [draftTitle, setDraftTitle] = useState(currentTitle);
	const [titleError, setTitleError] = useState('');

	// Seed local state only when the dialog opens, so a live query re-emit never
	// clobbers an in-progress edit.
	const wasOpen = useRef(false);
	useEffect(() => {
		if (open && !wasOpen.current) {
			setDraftTitle(currentTitle);
			setTitleError('');
		}
		wasOpen.current = open;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const trimmedTitle = draftTitle.trim();
	const canSaveTitle =
		trimmedTitle.length > 0 &&
		trimmedTitle.length <= FORM_LIMITS.feedbackTitle &&
		trimmedTitle !== currentTitle &&
		!isSaving;

	async function handleSaveTitle(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!canSaveTitle) return;

		setTitleError('');
		try {
			await onSave(trimmedTitle);
			onOpenChange(false);
		} catch (error) {
			setTitleError(localizeError(error, m.feedback_title_save_failed()));
		}
	}

	return (
		<ResponsiveDialog onOpenChange={onOpenChange} open={open}>
			<ResponsiveDialogContent
				className='flex flex-col gap-0 overflow-hidden p-0'
				dialogClassName='max-h-[85vh] sm:max-w-md'
				showCloseButton={false}
			>
				<ResponsiveDialogHeader icon={<EditIcon />} title={m.feedback_edit_title()} />
				<form className='flex min-h-0 flex-1 flex-col' onSubmit={handleSaveTitle}>
					<ResponsiveDialogBody className='flex flex-col gap-4'>
						<Field error={titleError} label={m.feedback_title()}>
							<Textarea
								autoFocus
								className='min-h-16 resize-none'
								disabled={isSaving}
								maxLength={FORM_LIMITS.feedbackTitle}
								onChange={(event) => {
									setDraftTitle(event.target.value);
									setTitleError('');
								}}
								value={draftTitle}
							/>
						</Field>
					</ResponsiveDialogBody>
					<ResponsiveDialogFooter>
						<Button
							disabled={isSaving}
							onClick={() => onOpenChange(false)}
							size='sm'
							type='button'
							variant='outline'
						>
							{m.common_cancel()}
						</Button>
						<Button disabled={!canSaveTitle} size='sm' type='submit'>
							{isSaving ? m.common_saving() : m.common_save()}
						</Button>
					</ResponsiveDialogFooter>
				</form>
			</ResponsiveDialogContent>
		</ResponsiveDialog>
	);
}

function DeleteFeedbackDialog({
	isDeleting,
	onDelete,
	onOpenChange,
	open,
}: {
	isDeleting: boolean;
	onDelete: () => Promise<unknown>;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const [deleteConfirm, setDeleteConfirm] = useState('');
	const [deleteError, setDeleteError] = useState('');

	const wasOpen = useRef(false);
	useEffect(() => {
		if (open && !wasOpen.current) {
			setDeleteConfirm('');
			setDeleteError('');
		}
		wasOpen.current = open;
	}, [open]);

	const canConfirmDelete = deleteConfirm === 'DELETE' && !isDeleting;

	async function handleDelete() {
		if (!canConfirmDelete) return;
		setDeleteError('');
		try {
			// Resolves into a navigation away from this page on success.
			await onDelete();
		} catch (error) {
			setDeleteError(localizeError(error, m.feedback_delete_failed()));
		}
	}

	return (
		<ResponsiveDialog onOpenChange={onOpenChange} open={open}>
			<ResponsiveDialogContent
				className='flex flex-col gap-0 overflow-hidden p-0'
				dialogClassName='max-h-[85vh] sm:max-w-md'
				showCloseButton={false}
			>
				<ResponsiveDialogHeader icon={<Trash2 />} title={m.feedback_delete_title()} />
				<div className='flex min-h-0 flex-1 flex-col'>
					<ResponsiveDialogBody className='flex flex-col gap-4'>
						<p className='text-sm text-muted-foreground'>{m.feedback_delete_description()}</p>
						<Field error={deleteError} label={m.feedback_delete_confirm()}>
							<Input
								onChange={(event) => {
									setDeleteConfirm(event.target.value);
									setDeleteError('');
								}}
								value={deleteConfirm}
							/>
						</Field>
					</ResponsiveDialogBody>
					<ResponsiveDialogFooter>
						<Button
							disabled={isDeleting}
							onClick={() => onOpenChange(false)}
							size='sm'
							type='button'
							variant='outline'
						>
							{m.common_cancel()}
						</Button>
						<Button
							disabled={!canConfirmDelete}
							onClick={handleDelete}
							size='sm'
							type='button'
							variant='destructive'
						>
							<Trash2 className='size-4' />
							{isDeleting ? m.common_deleting() : m.feedback_delete_permanently()}
						</Button>
					</ResponsiveDialogFooter>
				</div>
			</ResponsiveDialogContent>
		</ResponsiveDialog>
	);
}

function CloseFeedbackDialog({
	isClosing,
	onClose,
	onOpenChange,
	open,
}: {
	isClosing: boolean;
	onClose: () => Promise<unknown>;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const [closeError, setCloseError] = useState('');

	const wasOpen = useRef(false);
	useEffect(() => {
		if (open && !wasOpen.current) {
			setCloseError('');
		}
		wasOpen.current = open;
	}, [open]);

	async function handleClose() {
		if (isClosing) return;
		setCloseError('');
		try {
			await onClose();
			onOpenChange(false);
		} catch (error) {
			setCloseError(localizeError(error, m.feedback_close_failed()));
		}
	}

	return (
		<ResponsiveDialog onOpenChange={onOpenChange} open={open}>
			<ResponsiveDialogContent
				className='flex flex-col gap-0 overflow-hidden p-0'
				dialogClassName='max-h-[85vh] sm:max-w-md'
				showCloseButton={false}
			>
				<ResponsiveDialogHeader icon={<CircleSlash />} title={m.feedback_close_title()} />
				<div className='flex min-h-0 flex-1 flex-col'>
					<ResponsiveDialogBody className='flex flex-col gap-4'>
						<p className='text-sm text-muted-foreground'>{m.feedback_close_description()}</p>
						{closeError ? <p className='text-sm text-destructive'>{closeError}</p> : null}
					</ResponsiveDialogBody>
					<ResponsiveDialogFooter>
						<Button
							disabled={isClosing}
							onClick={() => onOpenChange(false)}
							size='sm'
							type='button'
							variant='outline'
						>
							{m.common_cancel()}
						</Button>
						<Button disabled={isClosing} onClick={handleClose} size='sm' type='button'>
							<CircleSlash className='size-4' />
							{isClosing ? m.common_closing() : m.feedback_close_title()}
						</Button>
					</ResponsiveDialogFooter>
				</div>
			</ResponsiveDialogContent>
		</ResponsiveDialog>
	);
}
