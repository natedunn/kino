// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import {
	getEditorDraftStorageKey,
	readEditorDraft,
	removeEditorDraft,
	writeEditorDraft,
} from './local-draft';

describe('editor local drafts', () => {
	afterEach(() => {
		window.localStorage.clear();
		window.history.replaceState({}, '', '/');
	});

	it('scopes draft keys to the current page and editor identifier', () => {
		window.history.replaceState({}, '', '/projects/kino/feedback/roadmap');

		expect(getEditorDraftStorageKey('comment-new')).toBe(
			'kino:markdown-editor:draft:v1:%2Fprojects%2Fkino%2Ffeedback%2Froadmap%3Acomment-new'
		);
	});

	it('writes, reads, and removes a draft from local storage', () => {
		const key = getEditorDraftStorageKey('comment-new');
		expect(key).not.toBeNull();

		writeEditorDraft(key!, '<p>Unsent thought</p>');
		expect(readEditorDraft(key!)).toBe('<p>Unsent thought</p>');

		removeEditorDraft(key!);
		expect(readEditorDraft(key!)).toBeNull();
	});
});
