export const UPDATE_LIST_PREVIEW_CHARS = 5000;

export function decodeBasicHtmlEntities(value: string) {
	const namedEntities: Record<string, string> = {
		amp: '&',
		apos: "'",
		gt: '>',
		lt: '<',
		nbsp: ' ',
		quot: '"',
	};

	return value.replace(/&(#(\d+)|#x([\da-f]+)|[a-z]+);/gi, (match, entity, decimal, hex) => {
		const codePoint = decimal ? Number(decimal) : hex ? Number.parseInt(hex, 16) : null;

		if (codePoint !== null) {
			return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
				? String.fromCodePoint(codePoint)
				: match;
		}

		return namedEntities[String(entity).toLowerCase()] ?? match;
	});
}

export function getUpdateListPreviewData(content: string) {
	const plainText = decodeBasicHtmlEntities(
		content
			.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
			.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
			.replace(/<[^>]*>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
	);
	const isTruncated = plainText.length > UPDATE_LIST_PREVIEW_CHARS;
	return {
		isTruncated,
		preview: isTruncated
			? `${plainText.slice(0, UPDATE_LIST_PREVIEW_CHARS).trimEnd()}...`
			: plainText,
	};
}

export function getUpdateListPreview(content: string) {
	return getUpdateListPreviewData(content).preview;
}

export function buildUpdateSearchContent(args: {
	content: string;
	tags?: Array<string> | null;
	title: string;
}) {
	return [args.title, ...(args.tags ?? []), getUpdateListPreview(args.content)].join('\n');
}
