import { ChartBar, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { FORM_LIMITS } from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

const MIN_OPTIONS = 2;

export type PollDraft = {
	// Keys keep each input stable while options are removed from the middle.
	options: Array<{ key: number; label: string }>;
	multiple: boolean;
};

export function emptyPollDraft(): PollDraft {
	return {
		options: Array.from({ length: MIN_OPTIONS }, (_, key) => ({ key, label: '' })),
		multiple: false,
	};
}

/** Mirrors the server's checks in `forumPolls.insertPoll` with friendlier messages. */
export function pollDraftError(draft: PollDraft) {
	const labels = draft.options.map((option) => option.label.trim());
	if (labels.some((label) => !label)) return m.forum_poll_option_required();
	if (labels.some((label) => label.length > FORM_LIMITS.forumPollOption))
		return m.forum_poll_option_too_long({ count: FORM_LIMITS.forumPollOption });
	if (new Set(labels.map((label) => label.toLowerCase())).size !== labels.length)
		return m.forum_poll_option_duplicate();
	return null;
}

export function NewPollFields({
	disabled,
	draft,
	onChange,
}: {
	disabled: boolean;
	/** Null until the author adds a poll. */
	draft: PollDraft | null;
	onChange: (draft: PollDraft | null) => void;
}) {
	if (!draft)
		return (
			<Button
				className='w-fit'
				disabled={disabled}
				onClick={() => onChange(emptyPollDraft())}
				type='button'
				variant='outline'
			>
				<ChartBar />
				{m.forum_poll_add()}
			</Button>
		);

	const setOptions = (options: PollDraft['options']) => onChange({ ...draft, options });
	const nextKey = Math.max(...draft.options.map((option) => option.key)) + 1;

	return (
		<div className='flex flex-col gap-2'>
			<div className='flex items-center justify-between gap-2'>
				<span className='text-sm font-medium' id='topic-poll'>
					{m.forum_poll_heading()}
				</span>
				<Button
					disabled={disabled}
					onClick={() => onChange(null)}
					size='sm'
					type='button'
					variant='ghost'
				>
					<X />
					{m.forum_poll_remove()}
				</Button>
			</div>
			<div
				aria-labelledby='topic-poll'
				className='flex flex-col gap-3 rounded-lg border bg-card p-4'
				role='group'
			>
				<p className='text-sm text-muted-foreground'>
					{m.forum_poll_options_hint({ count: FORM_LIMITS.forumPollOptions })}
				</p>
				<ol className='flex flex-col gap-2'>
					{draft.options.map((option, index) => (
						<li className='flex items-center gap-2' key={option.key}>
							<Input
								aria-label={m.forum_poll_option_label({ number: index + 1 })}
								disabled={disabled}
								maxLength={FORM_LIMITS.forumPollOption}
								onChange={(event) =>
									setOptions(
										draft.options.map((item) =>
											item.key === option.key ? { ...item, label: event.target.value } : item
										)
									)
								}
								placeholder={m.forum_poll_option_label({ number: index + 1 })}
								value={option.label}
							/>
							<Button
								aria-label={m.forum_poll_option_remove({ number: index + 1 })}
								className='shrink-0'
								disabled={disabled || draft.options.length <= MIN_OPTIONS}
								onClick={() => setOptions(draft.options.filter((item) => item.key !== option.key))}
								size='icon'
								type='button'
								variant='ghost'
							>
								<X className='size-4' />
							</Button>
						</li>
					))}
				</ol>
				{draft.options.length < FORM_LIMITS.forumPollOptions ? (
					<Button
						className='w-fit'
						disabled={disabled}
						onClick={() => setOptions([...draft.options, { key: nextKey, label: '' }])}
						size='sm'
						type='button'
						variant='outline'
					>
						<Plus />
						{m.forum_poll_option_add()}
					</Button>
				) : null}
				<label className='flex cursor-pointer items-center gap-2 text-sm'>
					<Checkbox
						checked={draft.multiple}
						disabled={disabled}
						onCheckedChange={(next) => onChange({ ...draft, multiple: next === true })}
					/>
					{m.forum_poll_multiple()}
				</label>
			</div>
		</div>
	);
}
