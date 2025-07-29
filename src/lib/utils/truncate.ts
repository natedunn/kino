/**
 * Truncates a string to the nearest space within a given character limit.
 * Appends "..." if truncation occurs.
 *
 * @param text The string to truncate.
 * @param maxLength The maximum desired length of the truncated string (including "...").
 * @returns The truncated string, or the original string if it's within the limit.
 */
export function truncateToNearestSpace(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text; // No truncation needed
	}

	// Calculate the actual limit for content, considering "..."
	const effectiveMaxLength = maxLength - 3;

	if (effectiveMaxLength <= 0) {
		// If maxLength is too small, just return "..." or a shortened "..."
		return '.'.repeat(Math.min(maxLength, 3));
	}

	// Find the last space before or at the effectiveMaxLength
	let lastSpaceIndex = text.lastIndexOf(' ', effectiveMaxLength);

	if (lastSpaceIndex === -1 || lastSpaceIndex === 0) {
		// No space found within the limit, or the first character is a space
		// Truncate at the effectiveMaxLength
		return text.substring(0, effectiveMaxLength) + '...';
	} else {
		// Truncate at the last found space
		return text.substring(0, lastSpaceIndex) + '...';
	}
}
