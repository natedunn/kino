import type { FunctionReturnType } from 'convex/server';
import type { Id } from '../../../../../../convex/native/_generated/dataModel';

import { useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import {
	ArrowRightLeft,
	Bell,
	BellOff,
	Info,
	Link as LinkIcon,
	Lock,
	LockOpen,
	Pin,
	PinOff,
	ShieldCheck,
	Trash2,
	Users,
} from 'lucide-react';

import { BoardIcon } from '@/components/board-icon';
import { InlineAlert } from '@/components/inline-alert';
import { ProfileLinkOrUnknown } from '@/components/profile-link';
import { SidebarSection } from '@/components/sidebar-section';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthSession } from '@/lib/auth/auth-client';
import { localizeError } from '@/lib/errors';
import { useSidebarState } from '@/lib/hooks/use-sidebar-state';
import { formatFullDate, formatRelativeDay } from '@/lib/utils/format-timestamp';
import * as m from '@/paraglide/messages.js';

import { api as nativeApi } from '../../../../../../convex/native/_generated/api';
import { DetailConvertDialog } from './detail-convert-dialog';
import { DetailLinks } from './detail-links';

const ROUTE = '/@{$org}/$project/discussions/$slug/' as const;
const SIDEBAR_STORAGE_KEY = 'discussion-detail-sidebar-state';
const DEFAULT_SIDEBAR_STATE = {
	details: true,
	participants: true,
	related: true,
	moderation: true,
};

export type DiscussionDetail = NonNullable<FunctionReturnType<typeof nativeApi.discussions.detail>>;
type CategoryOption = NonNullable<
	FunctionReturnType<typeof nativeApi.discussions.viewerAccess>
>['categories'][number];

// Follow/unfollow for signed-in viewers; signed-out viewers get a sign-in link
// that returns them here.
export function DetailFollowButton({
	className,
	detail,
	onError,
}: {
	className?: string;
	detail: DiscussionDetail;
	onError: (message: string | null) => void;
}) {
	const params = useParams({ from: ROUTE });
	const session = useAuthSession();
	const toggleFollow = useMutation(nativeApi.discussions.toggleFollow);
	const [busy, setBusy] = useState(false);
	const label = detail.viewerFollowing
		? m.discussions_detail_unfollow()
		: m.discussions_detail_follow();

	if (!session.user) {
		return (
			<Button asChild className={className} size='lg' variant='outline'>
				<Link
					search={
						{
							redirect: `/@${params.org}/${params.project}/discussions/${params.slug}`,
						} as never
					}
					to='/auth'
				>
					<Bell className='size-4' />
					{m.discussions_detail_follow()}
				</Link>
			</Button>
		);
	}

	return (
		<Button
			className={className}
			disabled={busy || !detail.writable}
			onClick={async () => {
				onError(null);
				setBusy(true);
				try {
					await toggleFollow({ discussionId: detail.discussion.id });
				} catch (mutationError) {
					onError(localizeError(mutationError, m.discussions_detail_follow_failed()));
				} finally {
					setBusy(false);
				}
			}}
			size='lg'
			variant='outline'
		>
			{detail.viewerFollowing ? <BellOff className='size-4' /> : <Bell className='size-4' />}
			{label}
		</Button>
	);
}

export function DetailSidebarSections({
	categories,
	detail,
	projectId,
}: {
	categories: Array<CategoryOption>;
	detail: DiscussionDetail;
	projectId: Id<'projects'>;
}) {
	const params = useParams({ from: ROUTE });
	const navigate = useNavigate();
	const { state: sidebarState, setSection: setSidebarSection } = useSidebarState(
		SIDEBAR_STORAGE_KEY,
		DEFAULT_SIDEBAR_STATE
	);
	const mutations = {
		remove: useMutation(nativeApi.discussions.remove),
		setCategory: useMutation(nativeApi.discussions.setCategory),
		setLocked: useMutation(nativeApi.discussions.setLocked),
		setPinned: useMutation(nativeApi.discussions.setPinned),
	};
	const [busy, setBusy] = useState(false);
	// Shown inside the section the failed action lives in.
	const [error, setError] = useState<{ message: string; section: 'details' | 'moderation' } | null>(
		null
	);
	const [convertOpen, setConvertOpen] = useState(false);
	const discussion = detail.discussion;
	// Authors can only move into categories they can post in; keep the current
	// one listed so the Select always shows it.
	const categoryOptions = categories.filter(
		(category) => category.canPost || category.id === detail.category?.id
	);
	// The query already drops missing profiles; narrow the nullable validator type.
	const participants = detail.participants.profiles.flatMap((profile) =>
		profile ? [profile] : []
	);
	const participantsOverflow = detail.participants.total - participants.length;

	async function run(
		section: 'details' | 'moderation',
		operation: () => Promise<unknown>,
		fallback: string
	) {
		setError(null);
		setBusy(true);
		try {
			await operation();
			return true;
		} catch (mutationError) {
			setError({ message: localizeError(mutationError, fallback), section });
			return false;
		} finally {
			setBusy(false);
		}
	}

	async function deleteDiscussion() {
		if (!window.confirm(m.discussions_delete_confirm())) return;
		const removed = await run(
			'moderation',
			() => mutations.remove({ discussionId: discussion.id }),
			m.discussions_delete_failed()
		);
		if (removed)
			await navigate({
				params: { org: params.org, project: params.project },
				to: '/@{$org}/$project/discussions',
			});
	}

	return (
		<>
			<SidebarSection
				icon={<Info className='size-3.5' />}
				onOpenChange={(open) => setSidebarSection('details', open)}
				open={sidebarState.details}
				title={m.discussions_detail_details()}
			>
				<div className='flex flex-col'>
					<div className='flex min-w-0 items-center justify-between gap-2 py-1.5'>
						<span className='text-sm text-muted-foreground'>{m.discussions_detail_category()}</span>
						{detail.canMove && categoryOptions.length ? (
							<Select
								disabled={busy}
								items={categoryOptions.map((category) => ({
									label: category.name,
									value: category.id,
								}))}
								onValueChange={(next) => {
									if (!next || next === detail.category?.id) return;
									void run(
										'details',
										() =>
											mutations.setCategory({
												discussionId: discussion.id,
												categoryId: next as Id<'discussionCategories'>,
											}),
										m.discussions_detail_category_failed()
									);
								}}
								value={detail.category?.id ?? ''}
							>
								<SelectTrigger className='min-w-32'>
									<SelectValue placeholder={m.discussions_detail_category_none()} />
								</SelectTrigger>
								<SelectContent>
									{categoryOptions.map((category) => (
										<SelectItem key={category.id} value={category.id}>
											<BoardIcon className='size-3.5' icon={category.icon} name={category.name} />
											{category.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : detail.category ? (
							<span className='flex min-w-0 items-center gap-1.5 text-sm'>
								<BoardIcon
									className='size-3.5 shrink-0'
									icon={detail.category.icon}
									name={detail.category.name}
								/>
								<span className='truncate'>{detail.category.name}</span>
							</span>
						) : (
							<span className='text-sm text-muted-foreground'>
								{m.discussions_detail_category_none()}
							</span>
						)}
					</div>
					<div className='flex items-center justify-between gap-2 py-1.5'>
						<span className='text-sm text-muted-foreground'>
							{m.discussions_detail_started_by()}
						</span>
						<ProfileLinkOrUnknown profile={detail.author} showAt />
					</div>
					<DateRow label={m.discussions_detail_created()} value={discussion.createdAt} />
					<DateRow label={m.discussions_detail_last_activity()} value={discussion.lastActivityAt} />
					{error?.section === 'details' ? (
						<InlineAlert className='mt-2' size='sm' variant='danger'>
							{error.message}
						</InlineAlert>
					) : null}
				</div>
			</SidebarSection>
			<SidebarSection
				icon={<Users className='size-3.5' />}
				onOpenChange={(open) => setSidebarSection('participants', open)}
				open={sidebarState.participants}
				title={m.discussions_detail_participants()}
			>
				<div className='flex flex-wrap items-center gap-1'>
					{participants.map((profile) => (
						<Tooltip key={profile.id}>
							<TooltipTrigger asChild delay={100}>
								<Link
									aria-label={`@${profile.username}`}
									className='rounded-full'
									params={{ username: profile.username }}
									to='/u/$username'
								>
									<Avatar
										className='size-7 border-2 border-background'
										fallbackName={profile.username}
									>
										<AvatarImage alt={profile.username} src={profile.imageUrl ?? undefined} />
										<AvatarFallback />
									</Avatar>
								</Link>
							</TooltipTrigger>
							<TooltipContent>@{profile.username}</TooltipContent>
						</Tooltip>
					))}
					{participantsOverflow > 0 ? (
						<span className='flex h-7 min-w-7 items-center justify-center rounded-full border bg-muted px-1.5 text-xs font-medium text-muted-foreground'>
							+{participantsOverflow}
						</span>
					) : null}
				</div>
			</SidebarSection>
			{detail.links.length || detail.canModerate ? (
				<SidebarSection
					icon={<LinkIcon className='size-3.5' />}
					onOpenChange={(open) => setSidebarSection('related', open)}
					open={sidebarState.related}
					title={m.discussions_detail_related()}
				>
					<DetailLinks
						canManage={detail.canModerate}
						discussionId={discussion.id}
						links={detail.links}
					/>
				</SidebarSection>
			) : null}
			{detail.canModerate || detail.canDelete ? (
				<SidebarSection
					icon={<ShieldCheck className='size-3.5' />}
					onOpenChange={(open) => setSidebarSection('moderation', open)}
					open={sidebarState.moderation}
					title={m.discussions_detail_moderation()}
				>
					<div className='flex flex-col gap-2'>
						{detail.canModerate ? (
							<>
								<Button
									className='justify-start'
									disabled={busy}
									onClick={() =>
										void run(
											'moderation',
											() =>
												mutations.setPinned({
													discussionId: discussion.id,
													pinned: !discussion.pinned,
												}),
											m.discussions_detail_pin_failed()
										)
									}
									variant='outline'
								>
									{discussion.pinned ? <PinOff className='size-4' /> : <Pin className='size-4' />}
									{discussion.pinned ? m.discussions_detail_unpin() : m.discussions_detail_pin()}
								</Button>
								<Button
									className='justify-start'
									disabled={busy}
									onClick={() =>
										void run(
											'moderation',
											() =>
												mutations.setLocked({
													discussionId: discussion.id,
													locked: !discussion.locked,
												}),
											m.discussions_detail_lock_failed()
										)
									}
									variant='outline'
								>
									{discussion.locked ? (
										<LockOpen className='size-4' />
									) : (
										<Lock className='size-4' />
									)}
									{discussion.locked ? m.discussions_detail_unlock() : m.discussions_detail_lock()}
								</Button>
								{/* Already converted: the notice in the thread links to the feedback. */}
								{detail.convertedTo ? null : (
									<>
										<Button
											className='justify-start'
											disabled={busy}
											onClick={() => setConvertOpen(true)}
											variant='outline'
										>
											<ArrowRightLeft className='size-4' />
											{m.discussions_detail_convert()}
										</Button>
										<DetailConvertDialog
											discussionId={discussion.id}
											onOpenChange={setConvertOpen}
											open={convertOpen}
											projectId={projectId}
										/>
									</>
								)}
							</>
						) : null}
						{detail.canDelete ? (
							<Button
								className='justify-start text-destructive'
								disabled={busy}
								onClick={() => void deleteDiscussion()}
								variant='outline'
							>
								<Trash2 className='size-4' />
								{m.discussions_delete()}
							</Button>
						) : null}
						{error?.section === 'moderation' ? (
							<InlineAlert size='sm' variant='danger'>
								{error.message}
							</InlineAlert>
						) : null}
					</div>
				</SidebarSection>
			) : null}
		</>
	);
}

function DateRow({ label, value }: { label: string; value: number }) {
	return (
		<div className='flex items-center justify-between gap-2 py-1.5'>
			<span className='text-sm text-muted-foreground'>{label}</span>
			<Tooltip>
				<TooltipTrigger asChild delay={100}>
					<span className='cursor-pointer text-sm' suppressHydrationWarning>
						{formatRelativeDay(value)}
					</span>
				</TooltipTrigger>
				<TooltipContent>
					<span suppressHydrationWarning>{formatFullDate(value)}</span>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
