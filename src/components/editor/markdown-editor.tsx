import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Underline } from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { cn } from '@/lib/utils';

import { EditorToolbar } from './editor-toolbar';
import { createShikiCodeBlock } from './extensions/shiki-code-block';

// Factory function to create fresh extension instances per editor
function createExtensions(placeholder: string) {
	return [
		StarterKit.configure({
			heading: { levels: [4, 5, 6] },
			codeBlock: false,
			// Disable StarterKit's Link and Underline - we configure our own below
			link: false,
			underline: false,
		}),
		Underline.configure({}),
		Link.configure({
			openOnClick: false,
			HTMLAttributes: {
				target: '_blank',
				rel: 'noopener noreferrer nofollow',
			},
		}),
		Placeholder.configure({ placeholder }),
		createShikiCodeBlock(),
	];
}

export type MarkdownEditorRef = {
	insertBlockquote: (content?: string, preserveHtml?: boolean) => void;
	insertText: (text: string) => void;
	focus: () => void;
	clear: () => void;
	getHTML: () => string;
	getText: () => string;
};

type MarkdownEditorProps = {
	value?: string;
	onChange?: (html: string) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	contentClassName?: string;
	minHeight?: string;
	maxHeight?: string;
	variant?: 'default' | 'borderless';
	autoFocus?: boolean;
	onSubmitShortcut?: () => void;
};

export const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
	(
		{
			value = '',
			onChange,
			placeholder = 'Write something...',
			disabled = false,
			className,
			contentClassName,
			minHeight = '100px',
			maxHeight,
			variant = 'default',
			autoFocus = false,
			onSubmitShortcut,
		},
		ref
	) => {
		// Use ref to guarantee extensions are created exactly once
		const extensionsRef = useRef<ReturnType<typeof createExtensions> | null>(null);
		if (!extensionsRef.current) {
			extensionsRef.current = createExtensions(placeholder);
		}

		// Store callback in ref to avoid recreating editor when callback changes
		const onSubmitShortcutRef = useRef(onSubmitShortcut);
		onSubmitShortcutRef.current = onSubmitShortcut;

		const editor = useEditor({
			extensions: extensionsRef.current,
			content: value,
			editable: !disabled,
			immediatelyRender: false,
			onUpdate: ({ editor }) => {
				onChange?.(editor.getHTML());
			},
			editorProps: {
				attributes: {
					class: cn(
						'prose prose-base max-w-none px-4 py-3 text-foreground focus:outline-none dark:prose-invert',
						'prose-headings:font-semibold',
						'prose-h4:text-[1.1rem] prose-h5:text-[1rem] prose-h6:text-[0.95rem]',
						'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
						'prose-code:before:content-none prose-code:after:content-none',
						'prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:pl-4 prose-blockquote:text-muted-foreground prose-blockquote:not-italic prose-blockquote:before:content-none prose-blockquote:after:content-none',
						'[&>blockquote:first-child>*:first-child]:mt-0',
						'prose-ol:my-1.5 prose-ul:my-1.5 prose-li:my-0 prose-li:leading-snug'
					),
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
		});

		// Auto-focus when enabled and editor is ready
		useEffect(() => {
			if (autoFocus && editor) {
				editor.commands.focus();
			}
		}, [autoFocus, editor]);

		useImperativeHandle(ref, () => ({
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
			insertText: (text: string) => {
				editor?.chain().focus().insertContent(text).run();
			},
			focus: () => {
				editor?.chain().focus().run();
			},
			clear: () => {
				editor?.commands.clearContent();
			},
			getHTML: () => {
				return editor?.getHTML() ?? '';
			},
			getText: () => {
				return editor?.getText() ?? '';
			},
		}));

		return (
			<div
				className={cn(
					'overflow-hidden rounded-md',
					variant === 'default' && [
						'border bg-white dark:bg-background',
						'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
					],
					disabled && 'cursor-not-allowed opacity-50',
					className
				)}
			>
				<EditorToolbar editor={editor} />
				<EditorContent
					editor={editor}
					style={{ minHeight, maxHeight }}
					className={cn(
						'[&_.ProseMirror]:min-h-[inherit]',
						maxHeight && 'overflow-y-auto',
						contentClassName
					)}
				/>
			</div>
		);
	}
);

MarkdownEditor.displayName = 'MarkdownEditor';
