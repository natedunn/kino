import type { Id } from '../../../../../../convex/native/_generated/dataModel';

import { useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { ChartBar, CircleCheck, Lock } from 'lucide-react';

import CheckboxButton from '@/components/checkbox-button';
import { Button } from '@/components/ui/button';
import { useAuthSession } from '@/lib/auth/auth-client';
import { localizeError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import * as m from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';

import { api as nativeApi } from '../../../../../../convex/native/_generated/api';

// A topic's poll, shown right under the opening post. Viewers who can vote
// and haven't yet pick options first; everyone else sees the results.
export function DetailPoll({
	onError,
	redirectTo,
	topicId,
}: {
	onError: (message: string | null) => void;
	redirectTo: string;
	topicId: Id<'forumTopics'>;
}) {
	const session = useAuthSession();
	const { data: poll } = useQuery(convexQuery(nativeApi.forumPolls.get, { topicId }));
	const vote = useMutation(nativeApi.forumPolls.vote);
	const setClosed = useMutation(nativeApi.forumPolls.setClosed);
	// The choices being edited; null shows results once the viewer has voted.
	const [draft, setDraft] = useState<Array<string> | null>(null);
	const [busy, setBusy] = useState(false);
	if (!poll) return null;

	const signedIn = !!session.user;
	const voted = poll.viewerOptionIds.length > 0;
	const choosing = signedIn && poll.canVote && (!voted || draft !== null);
	const choices = draft ?? [];
	const percent = new Intl.NumberFormat(getLocale(), {
		style: 'percent',
		maximumFractionDigits: 0,
	});

	async function run(operation: () => Promise<null>, fallback: string) {
		onError(null);
		setBusy(true);
		try {
			await operation();
			return true;
		} catch (error) {
			onError(localizeError(error, fallback));
			return false;
		} finally {
			setBusy(false);
		}
	}

	async function submit(optionIds: Array<string>) {
		if (!poll) return;
		if (await run(() => vote({ pollId: poll.id, optionIds }), m.forum_poll_vote_failed()))
			setDraft(null);
	}

	function toggle(id: string, checked: boolean) {
		if (!poll?.multiple) return setDraft([id]);
		setDraft(checked ? [...choices, id] : choices.filter((choice) => choice !== id));
	}

	return (
		<li className='relative z-10 flex flex-col overflow-hidden rounded-lg border bg-card'>
			<div className='flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-6 py-3'>
				<span className='flex items-center gap-2 text-sm font-medium'>
					<ChartBar className='size-4 text-muted-foreground' />
					{m.forum_poll_heading()}
				</span>
				{poll.closed ? (
					<span className='inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground'>
						<Lock className='size-3' />
						{m.forum_poll_closed()}
					</span>
				) : null}
			</div>
			<div className='flex flex-col gap-4 p-6'>
				{choosing ? (
					<>
						<p className='text-sm text-muted-foreground' id={`poll-${poll.id}-hint`}>
							{poll.multiple ? m.forum_poll_choose_many() : m.forum_poll_choose_one()}
						</p>
						<div
							aria-labelledby={`poll-${poll.id}-hint`}
							className='flex flex-col gap-2'
							role={poll.multiple ? 'group' : 'radiogroup'}
						>
							{poll.options.map((option) => (
								<CheckboxButton
									checked={choices.includes(option.id)}
									className='w-full justify-start text-left'
									disabled={busy}
									key={option.id}
									onChange={(checked) => toggle(option.id, checked)}
									role={poll.multiple ? 'checkbox' : 'radio'}
									size='lg'
								>
									<span className='min-w-0 break-words'>{option.label}</span>
								</CheckboxButton>
							))}
						</div>
					</>
				) : (
					<ul className='flex flex-col gap-2'>
						{poll.options.map((option) => {
							const mine = poll.viewerOptionIds.includes(option.id);
							const share = poll.voterCount ? option.votes / poll.voterCount : 0;
							return (
								<li
									className={cn(
										'relative overflow-hidden rounded-lg border px-4 py-2.5',
										mine && 'border-primary'
									)}
									key={option.id}
								>
									<div
										aria-hidden='true'
										className={cn(
											'absolute inset-y-0 left-0 transition-[width] duration-300',
											mine ? 'bg-primary/15' : 'bg-muted'
										)}
										style={{ width: `${share * 100}%` }}
									/>
									<div className='relative flex items-center justify-between gap-3 text-sm'>
										<span className='flex min-w-0 items-center gap-2 font-medium'>
											{mine ? (
												<>
													<CircleCheck
														aria-hidden='true'
														className='size-4 shrink-0 text-primary'
													/>
													<span className='sr-only'>{m.forum_poll_your_vote()}</span>
												</>
											) : null}
											<span className='min-w-0 break-words'>{option.label}</span>
										</span>
										<span className='flex shrink-0 items-baseline gap-2 tabular-nums'>
											<span className='font-semibold'>{percent.format(share)}</span>
											<span className='text-xs text-muted-foreground'>
												{m.forum_poll_vote_count({ count: option.votes })}
											</span>
										</span>
									</div>
								</li>
							);
						})}
					</ul>
				)}
				<div className='flex flex-wrap items-center justify-between gap-2'>
					<span className='text-sm text-muted-foreground'>
						{m.forum_poll_voter_count({ count: poll.voterCount })}
					</span>
					<div className='flex flex-wrap items-center gap-2'>
						{poll.canClose ? (
							<Button
								disabled={busy}
								onClick={() =>
									void run(
										() => setClosed({ pollId: poll.id, closed: !poll.closed }),
										m.forum_poll_close_failed()
									).then((done) => done && setDraft(null))
								}
								size='sm'
								variant='ghost'
							>
								{poll.closed ? m.forum_poll_reopen() : m.forum_poll_close()}
							</Button>
						) : null}
						{choosing ? (
							<>
								{voted ? (
									<>
										<Button
											disabled={busy}
											onClick={() => void submit([])}
											size='sm'
											variant='ghost'
										>
											{m.forum_poll_withdraw_vote()}
										</Button>
										<Button
											disabled={busy}
											onClick={() => setDraft(null)}
											size='sm'
											variant='outline'
										>
											{m.common_cancel()}
										</Button>
									</>
								) : null}
								<Button
									disabled={busy || !choices.length}
									onClick={() => void submit(choices)}
									size='sm'
								>
									{busy ? m.forum_poll_voting() : m.forum_poll_vote()}
								</Button>
							</>
						) : poll.canVote && signedIn ? (
							<Button
								disabled={busy}
								onClick={() => setDraft(poll.viewerOptionIds)}
								size='sm'
								variant='outline'
							>
								{m.forum_poll_change_vote()}
							</Button>
						) : poll.canVote ? (
							<Button asChild size='sm' variant='outline'>
								<Link search={{ redirect: redirectTo } as never} to='/auth'>
									{m.forum_poll_sign_in_to_vote()}
								</Link>
							</Button>
						) : null}
					</div>
				</div>
			</div>
		</li>
	);
}
