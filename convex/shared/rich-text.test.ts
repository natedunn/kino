import { describe, expect, it } from 'vitest';

import { sanitizeRichText } from './rich-text';

describe('sanitizeRichText', () => {
	it('keeps everything the editor produces', () => {
		const html =
			'<h2>Title</h2><p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s> <code>c</code><br></p>' +
			'<blockquote><p>q</p></blockquote><ul><li><p>a</p></li></ul><ol start="3"><li><p>b</p></li></ol>' +
			'<pre><code class="language-ts">const a = 1;</code></pre><hr>' +
			'<p><a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">link</a></p>';
		expect(sanitizeRichText(html)).toBe(html);
	});

	it('removes scripts, event handlers, and unknown tags', () => {
		expect(sanitizeRichText('<p onclick="x()">a</p><script>alert(1)</script>')).toBe('<p>a</p>');
		expect(sanitizeRichText('<img src=x onerror=alert(1)><p>b</p>')).toBe('<p>b</p>');
		expect(sanitizeRichText('<iframe src="https://evil.test"></iframe><p>c</p>')).toBe('<p>c</p>');
		expect(sanitizeRichText('<svg><a href="#">x</a></svg>')).toBe('<a href="#">x</a>');
		expect(sanitizeRichText('<div style="position:fixed">d</div>')).toBe('d');
	});

	it('drops unsafe links and attributes', () => {
		expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
		expect(sanitizeRichText('<a href=" JaVaScRiPt:alert(1)">x</a>')).toBe('<a>x</a>');
		expect(sanitizeRichText('<a href="data:text/html,<script>">x</a>')).toBe('<a>x</a>');
		expect(sanitizeRichText('<a href="//evil.test">x</a>')).toBe('<a>x</a>');
		expect(sanitizeRichText('<a href="/@org/project" target="_top">x</a>')).toBe(
			'<a href="/@org/project">x</a>'
		);
		expect(sanitizeRichText('<p class="fixed inset-0">x</p>')).toBe('<p>x</p>');
		expect(sanitizeRichText('<code class="bg-red-500">x</code>')).toBe('<code>x</code>');
	});

	it('leaves plain text alone apart from escaping markup', () => {
		expect(sanitizeRichText('Just text & more')).toBe('Just text & more');
	});
});
