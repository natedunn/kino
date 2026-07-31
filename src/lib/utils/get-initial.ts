/**
 * First character (uppercased) of the first non-empty value, for avatar
 * fallbacks. Guards against empty strings and null/undefined — `''[0]` is
 * `undefined`, so `''[0].toUpperCase()` throws; this never does.
 */
export function getInitial(...values: Array<string | null | undefined>): string {
	for (const value of values) {
		if (value) return value.charAt(0).toUpperCase();
	}
	return '?';
}
