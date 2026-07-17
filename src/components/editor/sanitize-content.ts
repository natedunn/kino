export function sanitizeEditorContent(html: string): string {
	if (!html) return html;

	let sanitized = html.replace(/(<p>(<br\/?>)?<\/p>\s*){3,}/gi, '<p></p><p></p>');
	sanitized = sanitized.replace(/(<p>(<br\/?>)?<\/p>\s*)+$/gi, '');

	if (/^(<p>(<br\/?>)?<\/p>\s*)+$/.test(sanitized)) {
		return '';
	}

	return sanitized;
}
