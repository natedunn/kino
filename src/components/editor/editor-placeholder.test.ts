import { describe, expect, it } from 'vitest';

import { htmlToTextBlocks } from './editor-placeholder';

describe('htmlToTextBlocks', () => {
	it('splits editor HTML into text blocks', () => {
		expect(
			htmlToTextBlocks(
				'<h2>Title</h2><p>One <strong>bold</strong></p><ul><li><p>Item</p></li></ul>'
			)
		).toEqual(['Title', 'One bold', 'Item']);
	});

	it('returns markup as inert text, never as elements', () => {
		expect(htmlToTextBlocks('<p>&lt;img src=x onerror=alert(1)&gt; &amp; ok</p>')).toEqual([
			'<img src=x onerror=alert(1)> & ok',
		]);
		expect(htmlToTextBlocks('<img src=x onerror=alert(1)><p>safe</p>')).toEqual(['safe']);
	});
});
