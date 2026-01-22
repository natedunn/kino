import type { RefObject } from 'react';
import type { MarkdownEditorRef } from './markdown-editor';

import { createContext, useContext, useRef } from 'react';

type EditorRefContextValue = {
	editorRef: RefObject<MarkdownEditorRef | null>;
};

const EditorRefContext = createContext<EditorRefContextValue | null>(null);

export function EditorRefProvider({ children }: { children: React.ReactNode }) {
	const editorRef = useRef<MarkdownEditorRef | null>(null);

	return <EditorRefContext.Provider value={{ editorRef }}>{children}</EditorRefContext.Provider>;
}

export function useEditorRef() {
	const context = useContext(EditorRefContext);
	if (!context) {
		throw new Error('useEditorRef must be used within EditorRefProvider');
	}
	return context.editorRef;
}
