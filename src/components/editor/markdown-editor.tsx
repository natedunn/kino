import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Underline } from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { cn } from '@/lib/utils';

import { EditorToolbar } from './editor-toolbar';
import { createLowlightCodeBlock } from './extensions/lowlight-code-block';
import {
	getEditorDraftStorageKey,
	readEditorDraft,
	removeEditorDraft,
	writeEditorDraft,
} from './local-draft';

function createExtensions(getPlaceholder: () => string) {
	return [
		StarterKit.configure({
			codeBlock: false,
			heading: { levels: [1, 2, 3, 4, 5, 6] },
			link: false,
			underline: false,
		}),
		Underline.configure({}),
		Link.configure({
			HTMLAttributes: {
				rel: 'noopener noreferrer nofollow',
				target: '_blank',
			},
			openOnClick: false,
		}),
		// Read the placeholder lazily so it can change without recreating the
		// editor (see the placeholder-sync effect below).
		Placeholder.configure({ placeholder: () => getPlaceholder() }),
		createLowlightCodeBlock(),
	];
}

export type MarkdownEditorRef = {
	clear: () => void;
	/** Removes the saved browser draft without changing the editor content. */
	clearLocalDraft: () => void;
	focus: () => void;
	getHTML: () => string;
	getText: () => string;
	insertBlockquote: (content?: string, preserveHtml?: boolean) => void;
	insertText: (text: string) => void;
};

type MarkdownEditorProps = {
	ariaLabel?: string;
	autoFocus?: boolean;
	className?: string;
	contentClassName?: string;
	disabled?: boolean;
	/** Stable identifier for this editor, scoped to the current pathname. */
	localDraftKey?: string;
	maxHeight?: string;
	minHeight?: string;
	onChange?: (html: string) => void;
	onSubmitShortcut?: () => void;
	placeholder?: string;
	/** Store and restore this editor's draft in localStorage. Defaults to true. */
	saveDraftLocally?: boolean;
	value?: string;
	variant?: 'borderless' | 'default';
};

export const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
	(
		{
			ariaLabel,
			autoFocus = false,
			className,
			contentClassName,
			disabled = false,
			localDraftKey,
			maxHeight,
			minHeight = '100px',
			onChange,
			onSubmitShortcut,
			placeholder = 'Write something...',
			saveDraftLocally = true,
			value = '',
			variant = 'default',
		},
		ref
	) => {
		// Keep callbacks and the placeholder in refs so the editor instance never
		// has to be recreated when they change (recreating would discard editor
		// state, selection, and undo history).
		const onChangeRef = useRef(onChange);
		onChangeRef.current = onChange;
		const onSubmitShortcutRef = useRef(onSubmitShortcut);
		onSubmitShortcutRef.current = onSubmitShortcut;
		const placeholderRef = useRef(placeholder);
		placeholderRef.current = placeholder;
		const ariaLabelRef = useRef(ariaLabel);
		ariaLabelRef.current = ariaLabel;
		const localDraftKeyRef = useRef(localDraftKey);
		localDraftKeyRef.current = localDraftKey;
		const saveDraftLocallyRef = useRef(saveDraftLocally);
		saveDraftLocallyRef.current = saveDraftLocally;

		const getCurrentDraftStorageKey = useCallback(
			() =>
				getEditorDraftStorageKey(
					localDraftKeyRef.current ?? ariaLabelRef.current ?? placeholderRef.current
				),
			[]
		);
		const clearCurrentLocalDraft = useCallback(() => {
			const key = getCurrentDraftStorageKey();
			if (key) removeEditorDraft(key);
		}, [getCurrentDraftStorageKey]);

		// Tracks the last HTML we emitted via onChange. Lets the value-sync effect
		// recognize its own echo and skip a second full getHTML() serialization on
		// every keystroke.
		const lastHTMLRef = useRef(value);

		const extensionsRef = useRef<ReturnType<typeof createExtensions> | null>(null);
		if (!extensionsRef.current) {
			extensionsRef.current = createExtensions(() => placeholderRef.current);
		}

		const editor = useEditor({
			content: value,
			editable: !disabled,
			editorProps: {
				attributes: {
					class: cn('markdown-prose px-4 py-3 focus:outline-none'),
					// Labels the contenteditable for screen readers, which otherwise only
					// see the placeholder (not exposed as an accessible name).
					...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
				},
				handleKeyDown: (_view, event) => {
					if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
						event.preventDefault();
						onSubmitShortcutRef.current?.();
						return true;
					}
					return false;
				},
			},
			extensions: extensionsRef.current,
			immediatelyRender: false,
			onUpdate: ({ editor: activeEditor }) => {
				const html = activeEditor.getHTML();
				lastHTMLRef.current = html;
				if (saveDraftLocallyRef.current) {
					const key = getCurrentDraftStorageKey();
					if (key) {
						if (activeEditor.isEmpty) removeEditorDraft(key);
						else writeEditorDraft(key, html);
					}
				}
				onChangeRef.current?.(html);
			},
		});

		useEffect(() => {
			if (autoFocus && editor) {
				editor.commands.focus();
			}
		}, [autoFocus, editor]);

		// Sync external value changes (initial async load, form reset) into the
		// editor. Skip our own echoes so typing doesn't pay a second full
		// getHTML() serialization on every keystroke.
		useEffect(() => {
			if (!editor) return;
			if (value === lastHTMLRef.current) return;
			if (value !== editor.getHTML()) {
				editor.commands.setContent(value, { emitUpdate: false });
			}
			if (!value) clearCurrentLocalDraft();
			lastHTMLRef.current = value;
		}, [clearCurrentLocalDraft, editor, value]);

		// Restore only after the initial controlled-value sync has run, then emit
		// the draft through onChange so the parent adopts it on its next render.
		useEffect(() => {
			if (!editor) return;
			const key = getEditorDraftStorageKey(localDraftKey ?? ariaLabel ?? placeholder);
			if (!key) return;
			if (!saveDraftLocally) {
				removeEditorDraft(key);
				return;
			}

			const draft = readEditorDraft(key);
			if (draft && draft !== editor.getHTML()) {
				editor.commands.setContent(draft);
			}
		}, [ariaLabel, editor, localDraftKey, placeholder, saveDraftLocally]);

		// Refresh the placeholder decoration when the placeholder prop changes. The
		// Placeholder extension reads the latest value through the ref getter; an
		// empty transaction forces ProseMirror to recompute its decorations without
		// mutating the document (so it never fires onChange).
		useEffect(() => {
			if (!editor) return;
			editor.view.dispatch(editor.state.tr);
		}, [editor, placeholder]);

		useImperativeHandle(ref, () => ({
			clear: () => {
				clearCurrentLocalDraft();
				editor?.commands.clearContent();
			},
			clearLocalDraft: clearCurrentLocalDraft,
			focus: () => editor?.chain().focus().run(),
			getHTML: () => editor?.getHTML() ?? '',
			getText: () => editor?.getText() ?? '',
			insertBlockquote: (content?: string, preserveHtml = false) => {
				if (!editor) return;
				if (content) {
					const blockquoteContent = preserveHtml
						? `<blockquote>${content}</blockquote><p></p>`
						: `<blockquote><p>${content}</p></blockquote><p></p>`;
					editor.chain().focus().insertContent(blockquoteContent).run();
				} else {
					editor.chain().focus().toggleBlockquote().run();
				}
			},
			insertText: (text: string) => editor?.chain().focus().insertContent(text).run(),
		}));

		return (
			<div
				className={cn(
					'overflow-hidden rounded-md',
					variant === 'default' && ['border bg-white dark:bg-background', 'relative z-10'],
					disabled && 'cursor-not-allowed opacity-50',
					className
				)}
			>
				<EditorToolbar editor={editor} />
				<EditorContent
					className={cn(
						'[&_.ProseMirror]:min-h-[inherit]',
						'[&_.ProseMirror:focus-visible]:ring-2 [&_.ProseMirror:focus-visible]:ring-ring [&_.ProseMirror:focus-visible]:ring-inset',
						// Isolate the editable region's layout from the rest of the page so
						// a growing document doesn't reflow ancestors (and vice-versa).
						// `layout` only — not `paint` — so the focus ring is never clipped.
						'[contain:layout]',
						maxHeight && 'overflow-y-auto',
						contentClassName
					)}
					editor={editor}
					style={{ maxHeight, minHeight }}
				/>
			</div>
		);
	}
);

MarkdownEditor.displayName = 'MarkdownEditor';
