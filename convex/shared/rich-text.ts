import { FilterXSS } from 'xss';

// Everything the app's Tiptap editor can produce (StarterKit, Underline, Link,
// lowlight code blocks). Anything else is dropped; its text is kept.
const ALLOWED: Record<string, Array<string>> = {
	a: ['href', 'rel', 'target'],
	blockquote: [],
	br: [],
	code: ['class'],
	del: [],
	em: [],
	h1: [],
	h2: [],
	h3: [],
	h4: [],
	h5: [],
	h6: [],
	hr: [],
	i: [],
	li: [],
	ol: ['start'],
	p: [],
	pre: ['class'],
	s: [],
	strong: [],
	b: [],
	u: [],
	ul: [],
};

const SAFE_HREF = /^(?:https?:|mailto:|\/(?!\/)|#)/i;

const filter = new FilterXSS({
	whiteList: ALLOWED,
	stripIgnoreTag: true,
	stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed', 'template'],
	css: false,
	// Returning undefined keeps an allowed attribute (the library still escapes
	// it and filters unsafe URLs); returning '' drops it.
	onTagAttr(_tag, name, value) {
		const valid =
			name === 'href'
				? SAFE_HREF.test(value.trim())
				: name === 'target'
					? value === '_blank'
					: name === 'class'
						? /^language-[\w-]+$/.test(value)
						: name === 'start'
							? /^\d{1,6}$/.test(value)
							: true;
		return valid ? undefined : '';
	},
});

/**
 * Allowlist-sanitize stored rich-text HTML. Applied when content is saved and
 * again before it is rendered with `dangerouslySetInnerHTML`, so content saved
 * before this existed (or through any other path) is safe too.
 */
export function sanitizeRichText(html: string): string {
	return filter.process(html);
}
