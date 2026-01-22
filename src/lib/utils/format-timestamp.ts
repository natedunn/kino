export function formatFullDate(timestamp: number): string {
	const date = new Date(timestamp);
	const day = date.getDate();
	const year = date.getFullYear();

	const months = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	];

	const getOrdinalSuffix = (day: number): string => {
		if (day >= 11 && day <= 13) return 'th';
		switch (day % 10) {
			case 1:
				return 'st';
			case 2:
				return 'nd';
			case 3:
				return 'rd';
			default:
				return 'th';
		}
	};

	return `${months[date.getMonth()]} ${day}${getOrdinalSuffix(day)}, ${year}`;
}

export function formatRelativeDay(timestamp: number): string {
	const date = new Date(timestamp);
	const now = new Date();

	// Reset times to midnight for day comparison
	const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	const diffDays = Math.floor((today.getTime() - dateDay.getTime()) / (1000 * 60 * 60 * 24));

	if (diffDays === 0) {
		return 'today';
	} else if (diffDays === 1) {
		return 'yesterday';
	} else if (diffDays < 7) {
		return `${diffDays} days ago`;
	} else if (diffDays < 14) {
		return '1 week ago';
	} else if (diffDays < 30) {
		const weeks = Math.floor(diffDays / 7);
		return `${weeks} weeks ago`;
	} else if (diffDays < 60) {
		return '1 month ago';
	} else if (diffDays < 365) {
		const months = Math.floor(diffDays / 30);
		return `${months} months ago`;
	} else {
		const years = Math.floor(diffDays / 365);
		return years === 1 ? '1 year ago' : `${years} years ago`;
	}
}

export function formatTimestamp(
	timestamp: number,
	opts: {
		ordinal?: boolean;
		alwaysIncludeYear?: boolean;
		yearComma?: boolean;
		relative?: boolean;
	} = {}
): string {
	const SECONDS = 1000;
	const MINUTES = 60 * SECONDS;
	const HOURS = 60 * MINUTES;
	const DAYS = 24 * HOURS;

	opts = { ordinal: false, alwaysIncludeYear: false, yearComma: true, relative: true, ...opts };

	const date = new Date(timestamp);
	const now = new Date();
	const diff = now.getTime() - date.getTime();

	if (opts.relative && diff < DAYS) {
		if (diff < MINUTES) {
			return 'just now';
		} else if (diff < HOURS) {
			const minutes = Math.floor(diff / MINUTES);
			return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
		} else {
			const hours = Math.floor(diff / HOURS);
			return `${hours} hour${hours > 1 ? 's' : ''} ago`;
		}
	}
	opts = { ordinal: false, alwaysIncludeYear: false, yearComma: true, ...opts };

	const currentYear = now.getFullYear();
	const dateYear = date.getFullYear();

	const months = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec',
	];

	const day = date.getDate();
	const month = months[date.getMonth()];

	// Add ordinal suffix
	const getOrdinalSuffix = (day: number): string => {
		if (day >= 11 && day <= 13) return 'th';
		switch (day % 10) {
			case 1:
				return 'st';
			case 2:
				return 'nd';
			case 3:
				return 'rd';
			default:
				return 'th';
		}
	};

	const ordinalDay = `${day}${opts.ordinal ? getOrdinalSuffix(day) : ''}`;

	const yearComma = opts.yearComma ? ',' : ' ';

	// Include year if different from current year

	if (opts.alwaysIncludeYear) {
		return `${month} ${ordinalDay}${yearComma} ${dateYear}`;
	} else {
		return dateYear !== currentYear
			? `${month} ${ordinalDay}${yearComma} ${dateYear}`
			: `${month} ${ordinalDay}`;
	}
}
