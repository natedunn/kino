import type { TargetGranularity } from '@convex/target';
import type { FormEvent } from 'react';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Calendar as CalendarIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
	ResponsiveDialog,
	ResponsiveDialogContent,
	ResponsiveDialogFooter,
	ResponsiveDialogHeader,
} from '@/components/ui/responsive-dialog';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { localizeError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import * as m from '@/paraglide/messages.js';

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

export function formatFeedbackTarget(
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

export function FeedbackTargetDrawer({
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
