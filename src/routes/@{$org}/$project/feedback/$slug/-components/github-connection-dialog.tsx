import type { GitHubTargetData } from '../-types';

import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Check, Link as LinkIcon, Plus, Search } from 'lucide-react';

import { Field } from '@/components/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	ResponsiveDialog,
	ResponsiveDialogContent,
	ResponsiveDialogFooter,
	ResponsiveDialogHeader,
} from '@/components/ui/responsive-dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { GithubIcon } from '@/icons';
import { useCRPC } from '@/lib/convex/crpc';
import { extractErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { FORM_LIMITS } from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

export function GithubConnectionIcon() {
	return <GithubIcon className='size-3.5 shrink-0 text-muted-foreground' />;
}

export function GithubIssueStateBadge({ state }: { state: string }) {
	const normalizedState = state.trim().toLowerCase();
	const isOpen = normalizedState === 'open';

	return (
		<span
			className={cn(
				'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium whitespace-nowrap capitalize',
				isOpen
					? 'bg-green-500/10 text-green-600 dark:text-green-400'
					: 'bg-muted text-muted-foreground'
			)}
		>
			{normalizedState || 'unknown'}
		</span>
	);
}

export function GitHubConnectionDialog({
	feedbackId,
	onOpenChange,
	open,
	orgSlug,
	projectSlug,
}: {
	feedbackId: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	orgSlug: string;
	projectSlug: string;
}) {
	return (
		<ResponsiveDialog open={open} onOpenChange={onOpenChange}>
			<ResponsiveDialogContent
				className='flex flex-col gap-0 overflow-hidden p-0'
				dialogClassName='max-h-[92vh] sm:max-w-xl'
				drawerClassName='max-h-[calc(100dvh-4rem)]'
				showCloseButton={false}
			>
				{/* The body owns all dialog state. It only mounts while the dialog is
            open, so closing it resets everything — no cleanup effect needed. */}
				<GitHubConnectionDialogBody
					feedbackId={feedbackId}
					onClose={() => onOpenChange(false)}
					orgSlug={orgSlug}
					projectSlug={projectSlug}
				/>
			</ResponsiveDialogContent>
		</ResponsiveDialog>
	);
}

function GitHubConnectionDialogBody({
	feedbackId,
	onClose,
	orgSlug,
	projectSlug,
}: {
	feedbackId: string;
	onClose: () => void;
	orgSlug: string;
	projectSlug: string;
}) {
	const crpc = useCRPC();
	const [mode, setMode] = useState<'existing' | 'create'>('existing');
	// Slide the mode panel in from the side its tab sits on (existing = left,
	// create = right), matching the target-timeframe dialog.
	const [slideFrom, setSlideFrom] = useState<'left' | 'right'>('right');
	const [query, setQuery] = useState('');
	// The debounced value actually drives the search query; `query` only feeds the
	// input so typing stays responsive without firing a request per keystroke.
	const [debouncedQuery, setDebouncedQuery] = useState('');
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [selectedTarget, setSelectedTarget] = useState<GitHubTargetData | null>(null);
	const [title, setTitle] = useState('');
	const [body, setBody] = useState('');
	const [localError, setLocalError] = useState('');

	const availabilityQuery = useQuery(
		crpc.feedbackGithub.getAvailability.queryOptions({ feedbackId }, { skipUnauth: true })
	);
	const availability = availabilityQuery.data;
	const sourceDisabled = !!availability && !availability.issuesEnabled;
	const writeDisabled = !!availability && availability.connected && !availability.writable;
	const repoMissing = !!availability && !availability.connected;
	// Searching a missing or read-only connection makes searchTargets throw a
	// server error (it requires read/write access), so only search when usable.
	const canSearch =
		mode === 'existing' &&
		!!availability &&
		availability.connected &&
		availability.writable &&
		availability.issuesEnabled;

	const searchQuery = useQuery(
		crpc.feedbackGithub.searchTargets.queryOptions(
			{
				feedbackId,
				kind: 'issue',
				query: debouncedQuery.slice(0, FORM_LIMITS.feedbackSearch),
			},
			{ enabled: canSearch }
		)
	);

	const connectExistingMutation = useMutation(
		// The connections list is a live subscription, so it updates on its own
		// once the connection is written server-side — just close the dialog.
		crpc.feedbackGithub.connectExisting.mutationOptions({
			onSuccess: onClose,
		})
	);
	const createMutation = useMutation(
		crpc.feedbackGithub.createAndConnect.mutationOptions({
			onSuccess: onClose,
		})
	);

	function handleModeChange(nextMode: 'create' | 'existing') {
		if (nextMode === mode) return;
		setSlideFrom(nextMode === 'create' ? 'right' : 'left');
		setMode(nextMode);
	}

	function handleQueryChange(value: string) {
		setQuery(value);
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			setDebouncedQuery(value);
			setSelectedTarget(null);
		}, 300);
	}

	const searchResults = (searchQuery.data ?? []) as Array<GitHubTargetData>;
	const searching = canSearch && searchQuery.isFetching;
	const requestError =
		availabilityQuery.error ??
		connectExistingMutation.error ??
		createMutation.error ??
		searchQuery.error;
	const error =
		localError ||
		(requestError ? extractErrorMessage(requestError, m.feedback_github_connect_failed()) : '');
	const feedbackUrl = typeof window === 'undefined' ? '' : window.location.href.split('#')[0];
	const canCreate =
		title.trim().length > 0 &&
		title.trim().length <= FORM_LIMITS.githubTitle &&
		body.trim().length <= FORM_LIMITS.githubBody &&
		!createMutation.isPending &&
		!sourceDisabled &&
		!writeDisabled &&
		!repoMissing;
	const canConnect =
		!!selectedTarget &&
		!sourceDisabled &&
		!writeDisabled &&
		!repoMissing &&
		!connectExistingMutation.isPending &&
		!searching;

	function handleConnectExisting() {
		setLocalError('');
		if (!selectedTarget || !feedbackUrl) return;

		connectExistingMutation.mutate({
			feedbackId,
			feedbackUrl,
			githubNumber: selectedTarget.number,
			kind: 'issue',
		});
	}

	function handleCreate() {
		setLocalError('');
		if (!feedbackUrl) return;
		if (title.trim().length > FORM_LIMITS.githubTitle) {
			setLocalError(`GitHub issue titles must be ${FORM_LIMITS.githubTitle} characters or fewer.`);
			return;
		}
		if (body.trim().length > FORM_LIMITS.githubBody) {
			setLocalError(`GitHub issue bodies must be ${FORM_LIMITS.githubBody} characters or fewer.`);
			return;
		}

		createMutation.mutate({
			body,
			feedbackId,
			feedbackUrl,
			kind: 'issue',
			title: title.trim(),
		});
	}

	return (
		<>
			<ResponsiveDialogHeader icon={<GithubIcon />} title={m.feedback_github_connect()} />

			{/* Mode nav — official Tabs, styled to match the target-timeframe dialog. */}
			<div className='border-b px-5 py-3'>
				<Tabs
					onValueChange={(value) => handleModeChange(value as 'create' | 'existing')}
					value={mode}
				>
					<TabsList
						className='grid h-auto w-full grid-cols-2 gap-1 rounded-lg border bg-muted p-1'
						indicatorClassName='h-[calc(var(--active-tab-height)-0.25rem)] bg-foreground shadow-xs ring-0'
					>
						<TabsTrigger
							className='h-8 rounded-md text-xs data-active:text-background'
							value='existing'
						>
							{m.feedback_github_link_existing()}
						</TabsTrigger>
						<TabsTrigger
							className='h-8 rounded-md text-xs data-active:text-background'
							value='create'
						>
							{m.feedback_github_create_new()}
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>

			{/* Body — a min-height floor keeps the dialog from resizing (and the tabs
          from jumping) as the two modes' content heights differ. */}
			<div className='min-h-[18rem] flex-1 overflow-x-hidden overflow-y-auto px-5 py-3 md:py-4'>
				{availabilityQuery.isLoading ? (
					<div className='space-y-2'>
						<div className='h-9 animate-pulse rounded-lg bg-muted/50' />
						<div className='h-14 animate-pulse rounded-lg bg-muted/50' />
						<div className='h-14 animate-pulse rounded-lg bg-muted/50' />
					</div>
				) : sourceDisabled ? (
					<GitHubConnectionNotice
						description={m.feedback_github_issues_disabled_description()}
						orgSlug={orgSlug}
						projectSlug={projectSlug}
						title={m.feedback_github_enable_issues()}
					/>
				) : repoMissing ? (
					<GitHubConnectionNotice
						description={m.feedback_github_repo_missing_description()}
						orgSlug={orgSlug}
						projectSlug={projectSlug}
						title={m.feedback_github_connect_repo()}
					/>
				) : writeDisabled ? (
					<GitHubConnectionNotice
						description={m.feedback_github_readonly_description()}
						orgSlug={orgSlug}
						projectSlug={projectSlug}
						title={m.feedback_github_reconnect_write()}
					/>
				) : mode === 'existing' ? (
					<div
						className={cn(
							'animate-in space-y-3 duration-200 fade-in-0',
							slideFrom === 'right' ? 'slide-in-from-right-6' : 'slide-in-from-left-6'
						)}
						key='existing'
					>
						<div className='relative'>
							<Search className='absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground' />
							<Input
								className='h-9 pl-9 text-sm'
								maxLength={FORM_LIMITS.feedbackSearch}
								onChange={(event) => handleQueryChange(event.target.value)}
								placeholder={m.feedback_github_search_issues()}
								value={query}
							/>
						</div>
						<div className='space-y-1'>
							{searching ? (
								<div className='space-y-1.5'>
									<div className='h-14 animate-pulse rounded-lg bg-muted/50' />
									<div className='h-14 animate-pulse rounded-lg bg-muted/50' />
								</div>
							) : searchResults.length > 0 ? (
								searchResults.map((target) => (
									<button
										className={cn(
											'flex w-full min-w-0 items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-all hover:bg-muted/50',
											selectedTarget?.nodeId === target.nodeId
												? 'border-primary/25 bg-primary/5 ring-1 ring-primary/20'
												: 'hover:border-border/60'
										)}
										key={target.nodeId}
										onClick={() => setSelectedTarget(target)}
										type='button'
									>
										<div className='flex size-7 shrink-0 items-center justify-center rounded-md bg-muted'>
											<GithubConnectionIcon />
										</div>
										<span className='min-w-0 flex-1'>
											<span className='block truncate text-sm leading-tight font-medium'>
												#{target.number} {target.title}
											</span>
											<span className='mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground'>
												<span
													className={cn(
														'size-1.5 rounded-full',
														target.state === 'open' ? 'bg-green-500' : 'bg-muted-foreground/50'
													)}
												/>
												{target.state}
											</span>
										</span>
										{selectedTarget?.nodeId === target.nodeId ? (
											<Check className='size-3.5 shrink-0 text-primary' />
										) : null}
									</button>
								))
							) : (
								<div className='rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground'>
									{searchQuery.isFetched
										? m.feedback_github_no_issues()
										: m.feedback_github_loading_issues()}
								</div>
							)}
						</div>
					</div>
				) : (
					<div
						className={cn(
							'animate-in space-y-3 duration-200 fade-in-0',
							slideFrom === 'right' ? 'slide-in-from-right-6' : 'slide-in-from-left-6'
						)}
						key='create'
					>
						<Field description={m.feedback_github_title_description()} label={m.feedback_title()}>
							<Input
								maxLength={FORM_LIMITS.githubTitle}
								onChange={(event) => setTitle(event.target.value)}
								placeholder={m.feedback_github_issue_title()}
								value={title}
							/>
						</Field>
						<Field
							description={m.feedback_github_body_description()}
							label={
								<>
									{m.feedback_github_body()}{' '}
									<span className='font-normal text-muted-foreground'>{m.feedback_optional()}</span>
								</>
							}
						>
							<Textarea
								className='min-h-28 resize-none'
								maxLength={FORM_LIMITS.githubBody}
								onChange={(event) => setBody(event.target.value)}
								placeholder={m.feedback_github_add_description()}
								value={body}
							/>
						</Field>
					</div>
				)}
			</div>

			<ResponsiveDialogFooter className='justify-between'>
				{error ? <p className='text-xs text-destructive'>{error}</p> : <span />}
				<div className='flex items-center gap-2'>
					<Button onClick={onClose} size='sm' type='button' variant='outline'>
						{m.common_cancel()}
					</Button>
					{mode === 'existing' ? (
						<Button disabled={!canConnect} onClick={handleConnectExisting} size='sm' type='button'>
							<LinkIcon className='size-3.5' />
							{m.feedback_github_connect_action()}
						</Button>
					) : (
						<Button disabled={!canCreate} onClick={handleCreate} size='sm' type='button'>
							<Plus className='size-3.5' />
							{m.feedback_github_create_connect()}
						</Button>
					)}
				</div>
			</ResponsiveDialogFooter>
		</>
	);
}

function GitHubConnectionNotice({
	description,
	orgSlug,
	projectSlug,
	title,
}: {
	description: string;
	orgSlug: string;
	projectSlug: string;
	title: string;
}) {
	return (
		<div className='rounded-lg border border-dashed p-5'>
			<div className='flex items-start gap-3'>
				<div className='flex size-8 shrink-0 items-center justify-center rounded-md bg-muted'>
					<GithubIcon className='size-3.5 text-muted-foreground' />
				</div>
				<div className='min-w-0 flex-1 space-y-3'>
					<div>
						<h3 className='text-sm leading-tight font-medium'>{title}</h3>
						<p className='mt-1 text-xs text-muted-foreground'>{description}</p>
					</div>
					<Button asChild size='sm' type='button' variant='outline'>
						<Link
							params={{ org: orgSlug, project: projectSlug }}
							to='/@{$org}/$project/settings/integrations'
						>
							<GithubIcon className='size-3.5' />
							Open GitHub settings
						</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
