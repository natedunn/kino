import type { FunctionReturnType } from 'convex/server';
import type { Id } from '../../../../../../convex/native/_generated/dataModel';

import { useEffect, useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { Megaphone, Plus, Search, X } from 'lucide-react';

import { InlineAlert } from '@/components/inline-alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StatusIcon } from '@/icons';
import { localizeError } from '@/lib/errors';
import { FORM_LIMITS } from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

import { api as nativeApi } from '../../../../../../convex/native/_generated/api';

const ROUTE = '/@{$org}/$project/discussions/$slug/' as const;
// Wait for a pause in typing before hitting the search index.
const SEARCH_DEBOUNCE_MS = 250;

type DiscussionLink = NonNullable<
	FunctionReturnType<typeof nativeApi.discussions.detail>
>['links'][number];

// Feedback and updates linked to a discussion. Moderators can add links from a
// search popover and remove them inline.
export function DetailLinks({
	canManage,
	discussionId,
	links,
}: {
	canManage: boolean;
	discussionId: Id<'discussions'>;
	links: Array<DiscussionLink>;
}) {
	const params = useParams({ from: ROUTE });
	const removeLink = useMutation(nativeApi.discussions.removeLink);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function remove(linkId: Id<'discussionLinks'>) {
		setError(null);
		setBusy(true);
		try {
			await removeLink({ linkId });
		} catch (mutationError) {
			setError(localizeError(mutationError, m.discussions_detail_link_failed()));
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className='flex flex-col gap-2'>
			{links.length ? (
				<div className='flex flex-col'>
					{links.map((link) => (
						<div className='group flex items-center gap-1' key={link.id}>
							{link.kind === 'feedback' ? (
								<Link
									className='flex min-w-0 flex-1 items-center gap-2.5 rounded-md py-2 transition-colors hover:bg-muted/50'
									params={{ org: params.org, project: params.project, slug: link.slug }}
									preload='intent'
									to='/@{$org}/$project/feedback/$slug'
								>
									<StatusIcon colored size='14' status={link.status} />
									<span className='flex-1 truncate text-sm'>{link.title}</span>
								</Link>
							) : (
								<Link
									className='flex min-w-0 flex-1 items-center gap-2.5 rounded-md py-2 transition-colors hover:bg-muted/50'
									params={{ org: params.org, project: params.project, slug: link.slug }}
									preload='intent'
									to='/@{$org}/$project/updates/$slug'
								>
									<Megaphone className='size-3.5 shrink-0 text-muted-foreground' />
									<span className='flex-1 truncate text-sm'>{link.title}</span>
								</Link>
							)}
							{canManage ? (
								<Button
									aria-label={m.discussions_detail_link_remove()}
									disabled={busy}
									onClick={() => void remove(link.id)}
									size='icon-sm'
									variant='ghost'
								>
									<X className='size-3.5' />
								</Button>
							) : null}
						</div>
					))}
				</div>
			) : (
				<p className='text-sm text-muted-foreground'>{m.discussions_detail_related_empty()}</p>
			)}
			{error ? (
				<InlineAlert size='sm' variant='danger'>
					{error}
				</InlineAlert>
			) : null}
			{canManage ? (
				<AddLinkPopover
					discussionId={discussionId}
					linkedIds={new Set(links.map((link) => link.targetId))}
				/>
			) : null}
		</div>
	);
}

function AddLinkPopover({
	discussionId,
	linkedIds,
}: {
	discussionId: Id<'discussions'>;
	linkedIds: Set<string>;
}) {
	const [open, setOpen] = useState(false);

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild>
				<Button className='w-fit' size='sm' variant='outline'>
					<Plus className='size-3.5' />
					{m.discussions_detail_link_add()}
				</Button>
			</PopoverTrigger>
			<PopoverContent align='start' className='w-80 p-2'>
				{/* Only mounted while open, so closing resets the search. */}
				{open ? (
					<AddLinkSearch
						discussionId={discussionId}
						linkedIds={linkedIds}
						onAdded={() => setOpen(false)}
					/>
				) : null}
			</PopoverContent>
		</Popover>
	);
}

function AddLinkSearch({
	discussionId,
	linkedIds,
	onAdded,
}: {
	discussionId: Id<'discussions'>;
	linkedIds: Set<string>;
	onAdded: () => void;
}) {
	const addLink = useMutation(nativeApi.discussions.addLink);
	const [search, setSearch] = useState('');
	const [debouncedSearch, setDebouncedSearch] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const term = debouncedSearch.trim();
	const candidates = useQuery(
		convexQuery(
			nativeApi.discussions.linkCandidates,
			term ? { discussionId, search: term } : 'skip'
		)
	);
	const results = (candidates.data ?? []).filter((item) => !linkedIds.has(item.id));

	useEffect(() => {
		const timeout = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timeout);
	}, [search]);

	async function add(
		target: { kind: 'feedback'; id: Id<'feedback'> } | { kind: 'update'; id: Id<'updates'> }
	) {
		setError(null);
		setBusy(true);
		try {
			await addLink({ discussionId, target });
			onAdded();
		} catch (mutationError) {
			setError(localizeError(mutationError, m.discussions_detail_link_failed()));
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className='flex flex-col gap-2'>
			<div className='relative'>
				<Search className='pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground' />
				<Input
					aria-label={m.discussions_detail_link_search_placeholder()}
					autoFocus
					className='pl-8'
					maxLength={FORM_LIMITS.discussionSearch}
					onChange={(event) => setSearch(event.target.value)}
					placeholder={m.discussions_detail_link_search_placeholder()}
					value={search}
				/>
			</div>
			{error ? (
				<InlineAlert size='sm' variant='danger'>
					{error}
				</InlineAlert>
			) : null}
			{!term ? (
				<p className='px-1 py-2 text-xs text-muted-foreground'>
					{m.discussions_detail_link_search_hint()}
				</p>
			) : candidates.isPending ? (
				<p className='px-1 py-2 text-xs text-muted-foreground'>{m.discussions_loading()}</p>
			) : results.length ? (
				<ul className='flex max-h-72 flex-col overflow-y-auto'>
					{results.map((item) => (
						<li key={item.id}>
							<button
								className='flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted/50 disabled:opacity-50'
								disabled={busy}
								onClick={() =>
									void add(
										item.kind === 'feedback'
											? { kind: 'feedback', id: item.id }
											: { kind: 'update', id: item.id }
									)
								}
								type='button'
							>
								{item.kind === 'feedback' ? (
									<StatusIcon colored size='14' status={item.status} />
								) : (
									<Megaphone className='size-3.5 shrink-0 text-muted-foreground' />
								)}
								<span className='flex-1 truncate'>{item.title}</span>
								<span className='shrink-0 text-xs text-muted-foreground'>
									{item.kind === 'feedback'
										? m.discussions_detail_link_kind_feedback()
										: m.discussions_detail_link_kind_update()}
								</span>
							</button>
						</li>
					))}
				</ul>
			) : (
				<p className='px-1 py-2 text-xs text-muted-foreground'>
					{m.discussions_detail_link_no_results()}
				</p>
			)}
		</div>
	);
}
