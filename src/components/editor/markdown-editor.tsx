import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Underline } from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { forwardRef, useImperativeHandle } from 'react';

import { cn } from '@/lib/utils';

import { ShikiCodeBlock } from './extensions/shiki-code-block';
import { EditorToolbar } from './editor-toolbar';

export type MarkdownEditorRef = {
  insertBlockquote: (text?: string) => void;
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
  minHeight?: string;
};

export const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
  (
    {
      value = '',
      onChange,
      placeholder = 'Write something...',
      disabled = false,
      className,
      minHeight = '100px',
    },
    ref
  ) => {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [4, 5, 6],
          },
          codeBlock: false,
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            target: '_blank',
            rel: 'noopener noreferrer nofollow',
          },
        }),
        Placeholder.configure({
          placeholder,
        }),
        ShikiCodeBlock,
      ],
      content: value,
      editable: !disabled,
      onUpdate: ({ editor }) => {
        onChange?.(editor.getHTML());
      },
      editorProps: {
        attributes: {
          class: cn(
            'prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2',
            'prose-headings:font-semibold',
            'prose-h4:text-[1.1rem] prose-h5:text-[1rem] prose-h6:text-[0.95rem]',
            'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
            'prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none',
            'prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:pl-4 prose-blockquote:text-muted-foreground'
          ),
        },
      },
    });

    useImperativeHandle(ref, () => ({
      insertBlockquote: (text?: string) => {
        if (!editor) return;
        if (text) {
          editor
            .chain()
            .focus()
            .insertContent(`<blockquote><p>${text}</p></blockquote><p></p>`)
            .run();
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
          'overflow-hidden rounded-md border bg-white dark:bg-input/30',
          'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
      >
        <EditorToolbar editor={editor} />
        <EditorContent
          editor={editor}
          style={{ minHeight }}
          className="[&_.ProseMirror]:min-h-[inherit]"
        />
      </div>
    );
  }
);

MarkdownEditor.displayName = 'MarkdownEditor';
