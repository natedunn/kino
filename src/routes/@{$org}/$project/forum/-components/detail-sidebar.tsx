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

const ROUTE = '/@{$org}/$project/forum/$slug/' as const;
const SIDEBAR_STORAGE_KEY = 'topic-detail-sidebar-state';
const DEFAULT_SIDEBAR_STATE = {
	details: true,
	participants: true,
	related: true,
	moderation: true,
};

export type TopicDetail = NonNullable<FunctionReturnType<typeof nativeApi.forum.detail>>;
type CategoryOption = NonNullable<
	FunctionReturnType<typeof nativeApi.forum.viewerAccess>
>['categories'][number];

// Follow/unfollow for signed-in viewers; signed-out viewers get a sign-in link
// that returns them here.
export function DetailFollowButton({
	className,
	detail,
	onError,
}: {
	className?: string;
	detail: TopicDetail;
	onError: (message: string | null) => void;
}) {
	const params = useParams({ from: ROUTE });
	const session = useAuthSession();
	const toggleFollow = useMutation(nativeApi.forum.toggleFollow);
	const [busy, setBusy] = useState(false);
	const label = detail.viewerFollowing ? m.forum_detail_unfollow() : m.forum_detail_follow();

	if (!session.user) {
		return (
			<Button asChild className={className} size='lg' variant='outline'>
				<Link
					search={
						{
							redirect: `/@${params.org}/${params.project}/forum/${params.slug}`,
						} as never
					}
					to='/auth'
				>
					<Bell className='size-4' />
					{m.forum_detail_follow()}
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
					await toggleFollow({ topicId: detail.topic.id });
				} catch (mutationError) {
					onError(localizeError(mutationError, m.forum_detail_follow_failed()));
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
	detail: TopicDetail;
	projectId: Id<'projects'>;
}) {
	const params = useParams({ from: ROUTE });
	const navigate = useNavigate();
	const { state: sidebarState, setSection: setSidebarSection } = useSidebarState(
		SIDEBAR_STORAGE_KEY,
		DEFAULT_SIDEBAR_STATE
	);
	const mutations = {
		remove: useMutation(nativeApi.forum.remove),
		setCategory: useMutation(nativeApi.forum.setCategory),
		setLocked: useMutation(nativeApi.forum.setLocked),
		setPinned: useMutation(nativeApi.forum.setPinned),
	};
	const [busy, setBusy] = useState(false);
	// Shown inside the section the failed action lives in.
	const [error, setError] = useState<{ message: string; section: 'details' | 'moderation' } | null>(
		null
	);
	const [convertOpen, setConvertOpen] = useState(false);
	const topic = detail.topic;
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

	async function deleteTopic() {
		if (!window.confirm(m.forum_delete_confirm())) return;
		const removed = await run(
			'moderation',
			() => mutations.remove({ topicId: topic.id }),
			m.forum_delete_failed()
		);
		if (removed)
			await navigate({
				params: { org: params.org, project: params.project },
				to: '/@{$org}/$project/forum',
			});
	}

	return (
		<>
			<SidebarSection
				icon={<Info className='size-3.5' />}
				onOpenChange={(open) => setSidebarSection('details', open)}
				open={sidebarState.details}
				title={m.forum_detail_details()}
			>
				<div className='flex flex-col'>
					<div className='flex min-w-0 items-center justify-between gap-2 py-1.5'>
						<span className='text-sm text-muted-foreground'>{m.forum_detail_category()}</span>
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
												topicId: topic.id,
												categoryId: next as Id<'forumCategories'>,
											}),
										m.forum_detail_category_failed()
									);
								}}
								value={detail.category?.id ?? ''}
							>
								<SelectTrigger className='min-w-32'>
									<SelectValue placeholder={m.forum_detail_category_none()} />
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
								{m.forum_detail_category_none()}
							</span>
						)}
					</div>
					<div className='flex items-center justify-between gap-2 py-1.5'>
						<span className='text-sm text-muted-foreground'>{m.forum_detail_started_by()}</span>
						<ProfileLinkOrUnknown profile={detail.author} showAt />
					</div>
					<DateRow label={m.forum_detail_created()} value={topic.createdAt} />
					<DateRow label={m.forum_detail_last_activity()} value={topic.lastActivityAt} />
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
				title={m.forum_detail_participants()}
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
					title={m.forum_detail_related()}
				>
					<DetailLinks canManage={detail.canModerate} topicId={topic.id} links={detail.links} />
				</SidebarSection>
			) : null}
			{detail.canModerate || detail.canDelete ? (
				<SidebarSection
					icon={<ShieldCheck className='size-3.5' />}
					onOpenChange={(open) => setSidebarSection('moderation', open)}
					open={sidebarState.moderation}
					title={m.forum_detail_moderation()}
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
													topicId: topic.id,
													pinned: !topic.pinned,
												}),
											m.forum_detail_pin_failed()
										)
									}
									variant='outline'
								>
									{topic.pinned ? <PinOff className='size-4' /> : <Pin className='size-4' />}
									{topic.pinned ? m.forum_detail_unpin() : m.forum_detail_pin()}
								</Button>
								<Button
									className='justify-start'
									disabled={busy}
									onClick={() =>
										void run(
											'moderation',
											() =>
												mutations.setLocked({
													topicId: topic.id,
													locked: !topic.locked,
												}),
											m.forum_detail_lock_failed()
										)
									}
									variant='outline'
								>
									{topic.locked ? <LockOpen className='size-4' /> : <Lock className='size-4' />}
									{topic.locked ? m.forum_detail_unlock() : m.forum_detail_lock()}
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
											{m.forum_detail_convert()}
										</Button>
										<DetailConvertDialog
											topicId={topic.id}
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
								onClick={() => void deleteTopic()}
								variant='outline'
							>
								<Trash2 className='size-4' />
								{m.forum_delete()}
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
