const EDITOR_DRAFT_STORAGE_PREFIX = 'kino:markdown-editor:draft:v1:';

export function getEditorDraftStorageKey(identifier: string): string | null {
	if (typeof window === 'undefined') return null;

	return `${EDITOR_DRAFT_STORAGE_PREFIX}${encodeURIComponent(`${window.location.pathname}:${identifier}`)}`;
}

export function readEditorDraft(key: string): string | null {
	try {
		return window.localStorage.getItem(key);
	} catch {
		// Storage can be unavailable in private browsing or when the user blocks it.
		return null;
	}
}

export function writeEditorDraft(key: string, content: string): void {
	try {
		window.localStorage.setItem(key, content);
	} catch {
		// Draft persistence is a convenience and should never prevent editing.
	}
}

export function removeEditorDraft(key: string): void {
	try {
		window.localStorage.removeItem(key);
	} catch {
		// See readEditorDraft: inaccessible storage should be a silent no-op.
	}
}
