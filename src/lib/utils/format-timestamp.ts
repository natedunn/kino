import { getLocale } from '@/paraglide/runtime.js';

const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function getDateFormatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
	const locale = getLocale();
	const key = `${locale}:${JSON.stringify(options)}`;
	let formatter = dateFormatters.get(key);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat(locale, options);
		dateFormatters.set(key, formatter);
	}
	return formatter;
}

/**
 * Coerce a Date, ISO string, or epoch-ms number to epoch milliseconds.
 * Use this to normalize the various timestamp shapes coming back from the
 * backend before passing them to the formatters below.
 */
export function toTimestamp(value: number | string | Date): number {
	if (value instanceof Date) return value.getTime();
	if (typeof value === 'string') return new Date(value).getTime();
	return value;
}

export function formatFullDate(timestamp: number): string {
	return getDateFormatter({ dateStyle: 'long' }).format(new Date(timestamp));
}

export function formatRelativeDay(timestamp: number): string {
	const date = new Date(timestamp);
	const now = new Date();

	// Reset times to midnight for day comparison
	const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	const diffDays = Math.floor((today.getTime() - dateDay.getTime()) / (1000 * 60 * 60 * 24));

	if (diffDays === 0) {
		return formatRelative(0, 'day');
	} else if (diffDays === 1) {
		return formatRelative(-1, 'day');
	} else if (diffDays < 7) {
		return formatRelative(-diffDays, 'day');
	} else if (diffDays < 14) {
		return formatRelative(-1, 'week');
	} else if (diffDays < 30) {
		const weeks = Math.floor(diffDays / 7);
		return formatRelative(-weeks, 'week');
	} else if (diffDays < 60) {
		return formatRelative(-1, 'month');
	} else if (diffDays < 365) {
		const months = Math.floor(diffDays / 30);
		return formatRelative(-months, 'month');
	} else {
		const years = Math.floor(diffDays / 365);
		return formatRelative(-years, 'year');
	}
}

export function formatTimestamp(
	timestamp: number,
	opts: {
		alwaysIncludeYear?: boolean;
		relative?: boolean;
	} = {}
): string {
	const SECONDS = 1000;
	const MINUTES = 60 * SECONDS;
	const HOURS = 60 * MINUTES;
	const DAYS = 24 * HOURS;

	opts = {
		alwaysIncludeYear: false,
		relative: true,
		...opts,
	};

	const date = new Date(timestamp);
	const now = new Date();
	const diff = now.getTime() - date.getTime();

	if (opts.relative && diff < DAYS) {
		if (diff < MINUTES) {
			return formatRelative(0, 'second');
		} else if (diff < HOURS) {
			const minutes = Math.floor(diff / MINUTES);
			return formatRelative(-minutes, 'minute');
		} else {
			const hours = Math.floor(diff / HOURS);
			return formatRelative(-hours, 'hour');
		}
	}
	const currentYear = now.getFullYear();
	const dateYear = date.getFullYear();
	const includeYear = opts.alwaysIncludeYear || dateYear !== currentYear;
	return getDateFormatter({
		day: 'numeric',
		month: 'short',
		...(includeYear ? { year: 'numeric' } : {}),
	}).format(date);
}

function formatRelative(value: number, unit: Intl.RelativeTimeFormatUnit): string {
	const locale = getLocale();
	let formatter = relativeFormatters.get(locale);
	if (!formatter) {
		formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
		relativeFormatters.set(locale, formatter);
	}
	return formatter.format(value, unit);
}
