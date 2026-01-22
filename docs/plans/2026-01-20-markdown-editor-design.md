# Markdown Editor Design

## Overview

Add WYSIWYG markdown editing to comments and feedback using Tiptap. Features a minimal toolbar with responsive overflow, syntax-highlighted code blocks via Shiki, and programmatic control for features like quoting comments.

## Features

### Text Formatting

- Bold, Italic, Underline, Strikethrough
- 3 heading levels (rendered as h4/h5/h6 for compact sizing)

### Block Elements

- Blockquotes
- Ordered and unordered lists
- Code blocks with syntax highlighting (Shiki)
- Inline code

### Links

- URL links (styled distinctly from underlined text)
- No image upload (deferred to separate feature)

### Keyboard Shortcuts

| Shortcut      | Action        |
| ------------- | ------------- |
| `Cmd+B`       | Bold          |
| `Cmd+I`       | Italic        |
| `Cmd+U`       | Underline     |
| `Cmd+Shift+S` | Strikethrough |
| `Cmd+K`       | Insert link   |
| `Cmd+E`       | Inline code   |
| `> `          | Blockquote    |
| `- ` or `* `  | Bullet list   |
| `1. `         | Numbered list |
| ` ` + Enter   | Code block    |

## Component Architecture

```
src/components/editor/
├── markdown-editor.tsx      # Main Tiptap editor wrapper
├── editor-toolbar.tsx       # Toolbar with responsive overflow
├── editor-content.tsx       # Styled content renderer (for display)
└── extensions/
    └── shiki-code-block.ts  # Custom CodeBlock with Shiki highlighting
```

### Editor API (via ref)

```typescript
interface MarkdownEditorRef {
	insertBlockquote: (text?: string) => void;
	insertText: (text: string) => void;
	focus: () => void;
	clear: () => void;
	getHTML: () => string;
	getText: () => string;
}
```

## Tiptap Extensions

**From StarterKit:**

- Bold, Italic, Strike
- BulletList, OrderedList, ListItem
- Blockquote
- Code (inline)
- Heading (levels 4, 5, 6)
- History, Paragraph, etc.

**Additional extensions:**

- `@tiptap/extension-underline`
- `@tiptap/extension-link`
- `@tiptap/extension-placeholder`
- `@tiptap/extension-code-block-lowlight` + Shiki

### Packages to Install

```bash
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-link @tiptap/extension-placeholder @tiptap/extension-code-block-lowlight shiki lowlight
```

## Toolbar

### Layout

```
[B] [I] [U] [S] | [Link] | [Code] [CodeBlock] | [Quote] | [UL] [OL] | [H▾] | [...]
```

### Responsive Overflow

- Use `ResizeObserver` to track toolbar width
- Items overflow right-to-left into `...` menu
- Priority (stays visible longest → overflows first):
  1. Bold, Italic
  2. Link
  3. Lists (UL, OL)
  4. Underline, Strike
  5. Quote, Code, CodeBlock
  6. Headings dropdown

### Button States

- Active state when cursor is in formatted text
- Disabled state when action unavailable

### Link Popover

Simple URL input popover, uses selected text or URL as display text.

## Styling

### Link vs Underline Differentiation

```css
/* Links - distinct color, no underline */
a {
	color: var(--color-primary);
	text-decoration: none;
}
a:hover {
	text-decoration: underline;
}

/* Underlined text - default color, solid underline */
u {
	color: inherit;
	text-decoration: underline;
}
```

### Compact Headers

```css
h4 {
	font-size: 1.1rem;
	font-weight: 600;
} /* Heading 1 */
h5 {
	font-size: 1rem;
	font-weight: 600;
} /* Heading 2 */
h6 {
	font-size: 0.95rem;
	font-weight: 600;
} /* Heading 3 */
```

### Code Blocks

- Rounded corners, subtle background
- Language label in top-right corner
- Shiki themes: `github-light` / `github-dark` (match app theme)

### Blockquotes

- Left border (3px solid)
- Left padding
- Muted text color

## Integration Points

### Files to Modify

1. `src/routes/@{$org}/$project/feedback/-components/comment-form.tsx`
   - Replace `Textarea` with `MarkdownEditor`
   - Expose editor ref via context

2. `src/routes/@{$org}/$project/feedback/new/-components/create-feedback-form.tsx`
   - Replace content `Textarea` with `MarkdownEditor`

3. Comment item dropdown (in comments-list.tsx area)
   - Add "Quote" action
   - Calls `editorRef.insertBlockquote(commentText)`

4. `src/routes/@{$org}/$project/feedback/$slug/index.tsx`
   - Add context provider for editor ref sharing

### Quote Button Flow

1. User clicks "Quote" in comment dropdown
2. Get comment's text content
3. Call `editorRef.current.insertBlockquote(commentText)`
4. Focus the editor

### Context Provider

Create `EditorRefContext` at feedback detail page level to share editor ref with comment list items.

## Storage

Comments store HTML output from Tiptap (`editor.getHTML()`). The existing `content` field in the database remains a string - no schema changes needed.

## Display

Create `EditorContent` component that renders stored HTML with proper styling. Use for:

- Displaying comments in comments-list.tsx
- Displaying initial feedback content
- Preview in feedback cards (may need to strip HTML for truncation)
