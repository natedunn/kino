import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Underline } from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { cn } from '@/lib/utils';

import { EditorToolbar } from './editor-toolbar';
import { createLowlightCodeBlock } from './extensions/lowlight-code-block';

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
	maxHeight?: string;
	minHeight?: string;
	onChange?: (html: string) => void;
	onSubmitShortcut?: () => void;
	placeholder?: string;
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
			maxHeight,
			minHeight = '100px',
			onChange,
			onSubmitShortcut,
			placeholder = 'Write something...',
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
			onUpdate: ({ editor }) => {
				const html = editor.getHTML();
				lastHTMLRef.current = html;
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
			lastHTMLRef.current = value;
		}, [editor, value]);

		// Refresh the placeholder decoration when the placeholder prop changes. The
		// Placeholder extension reads the latest value through the ref getter; an
		// empty transaction forces ProseMirror to recompute its decorations without
		// mutating the document (so it never fires onChange).
		useEffect(() => {
			if (!editor) return;
			editor.view.dispatch(editor.state.tr);
		}, [editor, placeholder]);

		useImperativeHandle(ref, () => ({
			clear: () => editor?.commands.clearContent(),
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
					variant === 'default' && [
						'border bg-white dark:bg-background',
						'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
						'relative z-10',
					],
					disabled && 'cursor-not-allowed opacity-50',
					className
				)}
			>
				<EditorToolbar editor={editor} />
				<EditorContent
					className={cn(
						'[&_.ProseMirror]:min-h-[inherit]',
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
