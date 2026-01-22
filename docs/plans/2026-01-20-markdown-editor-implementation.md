# Markdown Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add WYSIWYG markdown editing to comments and feedback using Tiptap with syntax-highlighted code blocks.

**Architecture:** Create a reusable `MarkdownEditor` component wrapping Tiptap with a responsive toolbar. Display rendered content using `EditorContent` component. Share editor ref via React context for features like "Quote" button.

**Tech Stack:** Tiptap, Shiki (syntax highlighting), @base-ui/react (popovers), React Context

---

## Task 1: Install Dependencies

**Step 1: Install Tiptap packages**

Run:

```bash
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-link @tiptap/extension-placeholder @tiptap/extension-code-block-lowlight lowlight shiki
```

**Step 2: Verify installation**

Run:

```bash
pnpm list @tiptap/react
```

Expected: Shows `@tiptap/react` version

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add Tiptap and Shiki dependencies for markdown editor"
```

---

## Task 2: Create Shiki Code Block Extension

**Files:**

- Create: `src/components/editor/extensions/shiki-code-block.ts`

**Step 1: Create the extension file**

```typescript
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';

// Create lowlight instance with common languages
const lowlight = createLowlight(common);

export const ShikiCodeBlock = CodeBlockLowlight.configure({
	lowlight,
	defaultLanguage: 'plaintext',
});
```

**Step 2: Commit**

```bash
git add src/components/editor/extensions/shiki-code-block.ts
git commit -m "feat: add Shiki code block extension for Tiptap"
```

---

## Task 3: Create Editor Toolbar Component

**Files:**

- Create: `src/components/editor/editor-toolbar.tsx`

**Step 1: Create toolbar component**

```typescript
import { type Editor } from '@tiptap/react';
import {
  Bold,
  Code,
  Code2,
  Heading,
  Italic,
  Link,
  List,
  ListOrdered,
  MoreHorizontal,
  Quote,
  Strikethrough,
  Underline,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type ToolbarItem = {
  id: string;
  icon: React.ReactNode;
  label: string;
  action: () => void;
  isActive?: () => boolean;
  group: number;
};

type EditorToolbarProps = {
  editor: Editor | null;
};

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [overflowItems, setOverflowItems] = useState<ToolbarItem[]>([]);
  const [visibleItems, setVisibleItems] = useState<ToolbarItem[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);

  const items: ToolbarItem[] = editor
    ? [
        {
          id: 'bold',
          icon: <Bold size={16} />,
          label: 'Bold',
          action: () => editor.chain().focus().toggleBold().run(),
          isActive: () => editor.isActive('bold'),
          group: 1,
        },
        {
          id: 'italic',
          icon: <Italic size={16} />,
          label: 'Italic',
          action: () => editor.chain().focus().toggleItalic().run(),
          isActive: () => editor.isActive('italic'),
          group: 1,
        },
        {
          id: 'underline',
          icon: <Underline size={16} />,
          label: 'Underline',
          action: () => editor.chain().focus().toggleUnderline().run(),
          isActive: () => editor.isActive('underline'),
          group: 1,
        },
        {
          id: 'strike',
          icon: <Strikethrough size={16} />,
          label: 'Strikethrough',
          action: () => editor.chain().focus().toggleStrike().run(),
          isActive: () => editor.isActive('strike'),
          group: 1,
        },
        {
          id: 'link',
          icon: <Link size={16} />,
          label: 'Link',
          action: () => {
            const previousUrl = editor.getAttributes('link').href;
            setLinkUrl(previousUrl || '');
            setLinkPopoverOpen(true);
          },
          isActive: () => editor.isActive('link'),
          group: 2,
        },
        {
          id: 'code',
          icon: <Code size={16} />,
          label: 'Inline Code',
          action: () => editor.chain().focus().toggleCode().run(),
          isActive: () => editor.isActive('code'),
          group: 3,
        },
        {
          id: 'codeBlock',
          icon: <Code2 size={16} />,
          label: 'Code Block',
          action: () => editor.chain().focus().toggleCodeBlock().run(),
          isActive: () => editor.isActive('codeBlock'),
          group: 3,
        },
        {
          id: 'blockquote',
          icon: <Quote size={16} />,
          label: 'Quote',
          action: () => editor.chain().focus().toggleBlockquote().run(),
          isActive: () => editor.isActive('blockquote'),
          group: 4,
        },
        {
          id: 'bulletList',
          icon: <List size={16} />,
          label: 'Bullet List',
          action: () => editor.chain().focus().toggleBulletList().run(),
          isActive: () => editor.isActive('bulletList'),
          group: 5,
        },
        {
          id: 'orderedList',
          icon: <ListOrdered size={16} />,
          label: 'Numbered List',
          action: () => editor.chain().focus().toggleOrderedList().run(),
          isActive: () => editor.isActive('orderedList'),
          group: 5,
        },
        {
          id: 'heading',
          icon: <Heading size={16} />,
          label: 'Heading',
          action: () => {}, // Handled by dropdown
          isActive: () =>
            editor.isActive('heading', { level: 4 }) ||
            editor.isActive('heading', { level: 5 }) ||
            editor.isActive('heading', { level: 6 }),
          group: 6,
        },
      ]
    : [];

  // Calculate visible items based on container width
  const calculateOverflow = useCallback(() => {
    if (!toolbarRef.current) return;

    const containerWidth = toolbarRef.current.offsetWidth;
    const buttonWidth = 36; // Approximate width of each button
    const dividerWidth = 17; // Approximate width of divider
    const overflowButtonWidth = 40;
    const padding = 8;

    let usedWidth = padding + overflowButtonWidth;
    let lastGroup = 0;
    const visible: ToolbarItem[] = [];
    const overflow: ToolbarItem[] = [];

    for (const item of items) {
      // Add divider width when group changes
      if (item.group !== lastGroup && lastGroup !== 0) {
        usedWidth += dividerWidth;
      }

      if (usedWidth + buttonWidth <= containerWidth) {
        visible.push(item);
        usedWidth += buttonWidth;
      } else {
        overflow.push(item);
      }

      lastGroup = item.group;
    }

    setVisibleItems(visible);
    setOverflowItems(overflow);
  }, [items]);

  useEffect(() => {
    calculateOverflow();

    const resizeObserver = new ResizeObserver(calculateOverflow);
    if (toolbarRef.current) {
      resizeObserver.observe(toolbarRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [calculateOverflow]);

  const applyLink = () => {
    if (linkUrl) {
      editor
        ?.chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: linkUrl, target: '_blank' })
        .run();
    } else {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setLinkPopoverOpen(false);
    setLinkUrl('');
  };

  if (!editor) return null;

  // Group items for rendering with dividers
  const renderVisibleItems = () => {
    const result: React.ReactNode[] = [];
    let lastGroup = 0;

    visibleItems.forEach((item, index) => {
      if (item.group !== lastGroup && lastGroup !== 0) {
        result.push(
          <div key={`divider-${index}`} className="mx-1 h-6 w-px bg-border" />
        );
      }

      if (item.id === 'heading') {
        result.push(
          <DropdownMenu key={item.id}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 w-8 p-0',
                  item.isActive?.() && 'bg-accent'
                )}
              >
                {item.icon}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
              >
                Heading 1
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
              >
                Heading 2
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
              >
                Heading 3
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      } else if (item.id === 'link') {
        result.push(
          <Popover key={item.id} open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn('h-8 w-8 p-0', item.isActive?.() && 'bg-accent')}
                onClick={item.action}
              >
                {item.icon}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">URL</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applyLink();
                    }
                  }}
                  placeholder="https://"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLinkPopoverOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={applyLink}>
                    Apply
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        );
      } else {
        result.push(
          <Button
            key={item.id}
            type="button"
            variant="ghost"
            size="sm"
            className={cn('h-8 w-8 p-0', item.isActive?.() && 'bg-accent')}
            onClick={item.action}
          >
            {item.icon}
          </Button>
        );
      }

      lastGroup = item.group;
    });

    return result;
  };

  return (
    <div
      ref={toolbarRef}
      className="flex items-center gap-0.5 border-b bg-muted/30 p-1"
    >
      {renderVisibleItems()}

      {overflowItems.length > 0 && (
        <>
          <div className="mx-1 h-6 w-px bg-border" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {overflowItems.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  onClick={item.action}
                  className={cn(item.isActive?.() && 'bg-accent')}
                >
                  {item.icon}
                  <span className="ml-2">{item.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/editor/editor-toolbar.tsx
git commit -m "feat: add responsive editor toolbar with overflow menu"
```

---

## Task 4: Create Main Markdown Editor Component

**Files:**

- Create: `src/components/editor/markdown-editor.tsx`

**Step 1: Create the editor component**

```typescript
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
          codeBlock: false, // We use ShikiCodeBlock instead
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
```

**Step 2: Commit**

```bash
git add src/components/editor/markdown-editor.tsx
git commit -m "feat: add main MarkdownEditor component with Tiptap"
```

---

## Task 5: Create Editor Content Display Component

**Files:**

- Create: `src/components/editor/editor-content-display.tsx`

**Step 1: Create the display component**

```typescript
import { cn } from '@/lib/utils';

type EditorContentDisplayProps = {
  content: string;
  className?: string;
};

export function EditorContentDisplay({ content, className }: EditorContentDisplayProps) {
  // Check if content looks like HTML (from new editor) or plain text (legacy)
  const isHTML = content.startsWith('<') && content.includes('</');

  if (!isHTML) {
    // Legacy plain text content - preserve whitespace
    return <div className={cn('whitespace-pre-wrap', className)}>{content}</div>;
  }

  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        // Headings
        'prose-headings:font-semibold',
        'prose-h4:text-[1.1rem] prose-h5:text-[1rem] prose-h6:text-[0.95rem]',
        // Links - distinct from underline
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        // Code
        'prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:bg-muted prose-pre:border prose-pre:p-4',
        // Blockquotes
        'prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:pl-4 prose-blockquote:text-muted-foreground prose-blockquote:not-italic',
        // Lists
        'prose-ul:my-2 prose-ol:my-2 prose-li:my-0',
        className
      )}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
```

**Step 2: Commit**

```bash
git add src/components/editor/editor-content-display.tsx
git commit -m "feat: add EditorContentDisplay for rendering markdown content"
```

---

## Task 6: Create Editor Index Export

**Files:**

- Create: `src/components/editor/index.ts`

**Step 1: Create barrel export**

```typescript
export { MarkdownEditor, type MarkdownEditorRef } from './markdown-editor';
export { EditorContentDisplay } from './editor-content-display';
```

**Step 2: Commit**

```bash
git add src/components/editor/index.ts
git commit -m "feat: add editor component exports"
```

---

## Task 7: Create Editor Ref Context

**Files:**

- Create: `src/components/editor/editor-context.tsx`

**Step 1: Create the context**

```typescript
import { createContext, useContext, useRef, type RefObject } from 'react';

import type { MarkdownEditorRef } from './markdown-editor';

type EditorRefContextValue = {
  editorRef: RefObject<MarkdownEditorRef | null>;
};

const EditorRefContext = createContext<EditorRefContextValue | null>(null);

export function EditorRefProvider({ children }: { children: React.ReactNode }) {
  const editorRef = useRef<MarkdownEditorRef | null>(null);

  return (
    <EditorRefContext.Provider value={{ editorRef }}>
      {children}
    </EditorRefContext.Provider>
  );
}

export function useEditorRef() {
  const context = useContext(EditorRefContext);
  if (!context) {
    throw new Error('useEditorRef must be used within EditorRefProvider');
  }
  return context.editorRef;
}
```

**Step 2: Update exports**

Edit `src/components/editor/index.ts`:

```typescript
export { MarkdownEditor, type MarkdownEditorRef } from './markdown-editor';
export { EditorContentDisplay } from './editor-content-display';
export { EditorRefProvider, useEditorRef } from './editor-context';
```

**Step 3: Commit**

```bash
git add src/components/editor/editor-context.tsx src/components/editor/index.ts
git commit -m "feat: add EditorRefContext for sharing editor ref"
```

---

## Task 8: Add Editor Placeholder Styles

**Files:**

- Modify: Find and modify the global CSS file (likely `src/app.css` or similar)

**Step 1: Find the global CSS file**

Run:

```bash
find src -name "*.css" -type f | head -5
```

**Step 2: Add placeholder styles**

Add to the global CSS:

```css
/* Tiptap editor placeholder */
.ProseMirror p.is-editor-empty:first-child::before {
	color: hsl(var(--muted-foreground));
	content: attr(data-placeholder);
	float: left;
	height: 0;
	pointer-events: none;
}

/* Code block styling */
.ProseMirror pre {
	background: hsl(var(--muted));
	border-radius: 0.375rem;
	padding: 0.75rem 1rem;
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.ProseMirror pre code {
	background: none;
	padding: 0;
	font-size: 0.875rem;
}

/* Syntax highlighting - uses lowlight/highlight.js classes */
.ProseMirror .hljs-comment,
.ProseMirror .hljs-quote {
	color: hsl(var(--muted-foreground));
}

.ProseMirror .hljs-keyword,
.ProseMirror .hljs-selector-tag,
.ProseMirror .hljs-addition {
	color: #c678dd;
}

.ProseMirror .hljs-string,
.ProseMirror .hljs-meta .hljs-string,
.ProseMirror .hljs-regexp,
.ProseMirror .hljs-attribute {
	color: #98c379;
}

.ProseMirror .hljs-number,
.ProseMirror .hljs-literal,
.ProseMirror .hljs-variable,
.ProseMirror .hljs-template-variable,
.ProseMirror .hljs-type,
.ProseMirror .hljs-deletion {
	color: #d19a66;
}

.ProseMirror .hljs-title,
.ProseMirror .hljs-section,
.ProseMirror .hljs-name,
.ProseMirror .hljs-selector-id,
.ProseMirror .hljs-selector-class {
	color: #e06c75;
}

.ProseMirror .hljs-function,
.ProseMirror .hljs-params {
	color: #61afef;
}

.ProseMirror .hljs-built_in,
.ProseMirror .hljs-tag {
	color: #56b6c2;
}
```

**Step 3: Commit**

```bash
git add src/*.css
git commit -m "feat: add Tiptap editor styles and syntax highlighting"
```

---

## Task 9: Integrate Editor into Comment Form

**Files:**

- Modify: `src/routes/@{$org}/$project/feedback/-components/comment-form.tsx`

**Step 1: Replace Textarea with MarkdownEditor**

Replace the entire file content:

```typescript
import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { api } from '~api';
import { Button } from '@/components/ui/button';
import { MarkdownEditor, type MarkdownEditorRef, useEditorRef } from '@/components/editor';
import { Id } from '@/convex/_generated/dataModel';

type CommentFormProps = {
  feedbackId: Id<'feedback'>;
};

export function CommentForm({ feedbackId }: CommentFormProps) {
  const [content, setContent] = useState('');
  const localRef = useRef<MarkdownEditorRef>(null);

  // Try to get shared ref from context, fall back to local ref
  let editorRef: React.RefObject<MarkdownEditorRef | null>;
  try {
    editorRef = useEditorRef();
  } catch {
    editorRef = localRef;
  }

  const { mutate: createComment, status } = useMutation({
    mutationFn: useConvexMutation(api.feedbackComment.create),
    onSuccess: () => {
      setContent('');
      editorRef.current?.clear();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const html = editorRef.current?.getHTML() ?? content;
    const text = editorRef.current?.getText() ?? '';

    if (!text.trim()) return;

    createComment({
      feedbackId,
      content: html,
    });
  };

  const isSubmitting = status === 'pending';

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 rounded-lg border bg-accent/30 p-4">
      <MarkdownEditor
        ref={editorRef}
        value={content}
        onChange={setContent}
        placeholder="Leave a comment..."
        disabled={isSubmitting}
        minHeight="60px"
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || !content.trim()}>
          {isSubmitting ? 'Posting...' : 'Comment'}
        </Button>
      </div>
    </form>
  );
}
```

**Step 2: Verify build**

Run:

```bash
pnpm run tsc
```

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/routes/@{$org}/$project/feedback/-components/comment-form.tsx
git commit -m "feat: integrate MarkdownEditor into comment form"
```

---

## Task 10: Integrate Editor into Feedback Creation Form

**Files:**

- Modify: `src/routes/@{$org}/$project/feedback/new/-components/create-feedback-form.tsx`

**Step 1: Import and use MarkdownEditor**

Replace the Textarea import and usage. Change:

```typescript
import { Textarea } from '@/components/ui/textarea';
```

To:

```typescript
import { MarkdownEditor } from '@/components/editor';
```

**Step 2: Replace the firstComment field**

Find the `form.AppField` for `firstComment` and replace the Textarea with MarkdownEditor:

```typescript
<form.AppField name='firstComment'>
  {(field) => (
    <field.Provider>
      <field.Label>Content</field.Label>
      <field.Control>
        <MarkdownEditor
          value={field.state.value}
          onChange={(html) => field.handleChange(html)}
          disabled={!enabled}
          placeholder="Describe your feedback..."
          minHeight="120px"
        />
      </field.Control>
    </field.Provider>
  )}
</form.AppField>
```

**Step 3: Verify build**

Run:

```bash
pnpm run tsc
```

**Step 4: Commit**

```bash
git add src/routes/@{$org}/$project/feedback/new/-components/create-feedback-form.tsx
git commit -m "feat: integrate MarkdownEditor into feedback creation form"
```

---

## Task 11: Update Comments Display to Render HTML

**Files:**

- Modify: `src/routes/@{$org}/$project/feedback/-components/comments-list.tsx`

**Step 1: Import EditorContentDisplay**

Add import:

```typescript
import { EditorContentDisplay } from '@/components/editor';
```

**Step 2: Replace content rendering**

Find the line in CommentItem:

```typescript
<div className="whitespace-pre-wrap">{comment.content}</div>
```

Replace with:

```typescript
<EditorContentDisplay content={comment.content} />
```

**Step 3: Commit**

```bash
git add src/routes/@{$org}/$project/feedback/-components/comments-list.tsx
git commit -m "feat: render comment content as HTML with EditorContentDisplay"
```

---

## Task 12: Update Feedback Detail to Render HTML

**Files:**

- Modify: `src/routes/@{$org}/$project/feedback/$slug/index.tsx`

**Step 1: Import EditorContentDisplay and EditorRefProvider**

Add to imports:

```typescript
import { EditorContentDisplay, EditorRefProvider } from '@/components/editor';
```

**Step 2: Find first comment content and replace**

Find the line (around line 344):

```typescript
<div className="whitespace-pre-wrap">{firstComment.content}</div>
```

Replace with:

```typescript
<EditorContentDisplay content={firstComment.content} />
```

**Step 3: Wrap comment form area with provider**

Find the CommentForm usage and wrap the relevant section with EditorRefProvider so comments can access the editor ref:

```typescript
<EditorRefProvider>
  {/* Additional comments */}
  <CommentsList feedbackId={feedback._id} currentProfileId={currentProfile?._id} />

  {/* Comment form */}
  <CommentForm feedbackId={feedback._id} />
</EditorRefProvider>
```

**Step 4: Commit**

```bash
git add src/routes/@{$org}/$project/feedback/$slug/index.tsx
git commit -m "feat: use EditorContentDisplay for feedback content and add EditorRefProvider"
```

---

## Task 13: Add Quote Button to Comment Dropdown

**Files:**

- Modify: `src/routes/@{$org}/$project/feedback/-components/comments-list.tsx`

**Step 1: Import useEditorRef and Quote icon**

Add to imports:

```typescript
import { MoreHorizontal, Quote, Trash2 } from 'lucide-react';

import { useEditorRef } from '@/components/editor';
```

**Step 2: Add Quote functionality to CommentItem**

Inside the CommentItem function, add after the isOwner check:

```typescript
// Get editor ref for Quote feature
let editorRef: React.RefObject<any> | null = null;
try {
	editorRef = useEditorRef();
} catch {
	// Not within EditorRefProvider
}

const handleQuote = () => {
	if (!editorRef?.current) return;
	// Strip HTML tags for plain text quote
	const plainText = comment.content.replace(/<[^>]*>/g, '');
	editorRef.current.insertBlockquote(plainText);
	editorRef.current.focus();
};
```

**Step 3: Add Quote menu item**

In the DropdownMenuContent, add the Quote option before the delete (it should be available to everyone, not just owners):

Move the dropdown outside the `{isOwner && ...}` block and restructure:

```typescript
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm" disabled={isDeleting}>
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">More Actions</span>
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    {editorRef && (
      <DropdownMenuItem onClick={handleQuote}>
        <Quote size={14} />
        Quote
      </DropdownMenuItem>
    )}
    {isOwner && (
      <DropdownMenuItem
        onClick={handleDelete}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 size={14} />
        Delete
      </DropdownMenuItem>
    )}
  </DropdownMenuContent>
</DropdownMenu>
```

**Step 4: Verify build**

Run:

```bash
pnpm run tsc
```

**Step 5: Commit**

```bash
git add src/routes/@{$org}/$project/feedback/-components/comments-list.tsx
git commit -m "feat: add Quote button to comment dropdown"
```

---

## Task 14: Test the Implementation

**Step 1: Start dev server**

Run:

```bash
pnpm run dev
```

**Step 2: Manual testing checklist**

Test the following:

1. **New feedback form** (`/@org/project/feedback/new`)
   - [ ] Editor renders with toolbar
   - [ ] Bold, italic, underline, strikethrough work
   - [ ] Link button opens popover
   - [ ] Code and code block work
   - [ ] Lists work
   - [ ] Headings dropdown works
   - [ ] Keyboard shortcuts work (Cmd+B, Cmd+I, etc.)
   - [ ] Form submits successfully

2. **Feedback detail page** (`/@org/project/feedback/[slug]`)
   - [ ] Existing comments render (backwards compatible)
   - [ ] New comment editor renders
   - [ ] Comments with HTML render correctly
   - [ ] Quote button appears in comment dropdown
   - [ ] Quote button inserts blockquote into editor

3. **Responsive toolbar**
   - [ ] Resize browser and verify items move to overflow menu

**Step 3: Final commit**

```bash
git add -A
git commit -m "test: verify markdown editor implementation"
```

---

## Summary

This plan implements:

1. **Tiptap WYSIWYG editor** with all requested formatting options
2. **Responsive toolbar** with overflow menu for small screens
3. **Syntax highlighting** for code blocks via lowlight
4. **Quote button** in comment dropdown using shared editor context
5. **Backwards compatibility** for existing plain text comments
6. **Full keyboard shortcuts** for power users

Total: 14 tasks with incremental commits for easy rollback if needed.
