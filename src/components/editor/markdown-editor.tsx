import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import { Link } from "@tiptap/extension-link"
import { Placeholder } from "@tiptap/extension-placeholder"
import { Underline } from "@tiptap/extension-underline"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"

import { cn } from "@/lib/utils"

import { EditorToolbar } from "./editor-toolbar"
import { createShikiCodeBlock } from "./extensions/shiki-code-block"

function createExtensions(placeholder: string) {
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
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      },
      openOnClick: false,
    }),
    Placeholder.configure({ placeholder }),
    createShikiCodeBlock(),
  ]
}

export type MarkdownEditorRef = {
  clear: () => void
  focus: () => void
  getHTML: () => string
  getText: () => string
  insertBlockquote: (content?: string, preserveHtml?: boolean) => void
  insertText: (text: string) => void
}

type MarkdownEditorProps = {
  autoFocus?: boolean
  className?: string
  contentClassName?: string
  disabled?: boolean
  maxHeight?: string
  minHeight?: string
  onChange?: (html: string) => void
  onSubmitShortcut?: () => void
  placeholder?: string
  value?: string
  variant?: "borderless" | "default"
}

export const MarkdownEditor = forwardRef<
  MarkdownEditorRef,
  MarkdownEditorProps
>(
  (
    {
      autoFocus = false,
      className,
      contentClassName,
      disabled = false,
      maxHeight,
      minHeight = "100px",
      onChange,
      onSubmitShortcut,
      placeholder = "Write something...",
      value = "",
      variant = "default",
    },
    ref
  ) => {
    const extensionsRef = useRef<ReturnType<typeof createExtensions> | null>(
      null
    )
    if (!extensionsRef.current) {
      extensionsRef.current = createExtensions(placeholder)
    }

    const onSubmitShortcutRef = useRef(onSubmitShortcut)
    onSubmitShortcutRef.current = onSubmitShortcut

    const editor = useEditor({
      content: value,
      editable: !disabled,
      editorProps: {
        attributes: {
          class: cn("markdown-prose px-4 py-3 focus:outline-none"),
        },
        handleKeyDown: (_view, event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault()
            onSubmitShortcutRef.current?.()
            return true
          }
          return false
        },
      },
      extensions: extensionsRef.current,
      immediatelyRender: false,
      onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    })

    useEffect(() => {
      if (autoFocus && editor) {
        editor.commands.focus()
      }
    }, [autoFocus, editor])

    useEffect(() => {
      if (!editor) return
      const current = editor.getHTML()
      if (value !== current) {
        editor.commands.setContent(value, { emitUpdate: false })
      }
    }, [editor, value])

    useImperativeHandle(ref, () => ({
      clear: () => editor?.commands.clearContent(),
      focus: () => editor?.chain().focus().run(),
      getHTML: () => editor?.getHTML() ?? "",
      getText: () => editor?.getText() ?? "",
      insertBlockquote: (content?: string, preserveHtml = false) => {
        if (!editor) return
        if (content) {
          const blockquoteContent = preserveHtml
            ? `<blockquote>${content}</blockquote><p></p>`
            : `<blockquote><p>${content}</p></blockquote><p></p>`
          editor.chain().focus().insertContent(blockquoteContent).run()
        } else {
          editor.chain().focus().toggleBlockquote().run()
        }
      },
      insertText: (text: string) =>
        editor?.chain().focus().insertContent(text).run(),
    }))

    return (
      <div
        className={cn(
          "overflow-hidden rounded-md",
          variant === "default" && [
            "border bg-white dark:bg-background",
            "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
            "relative z-10",
          ],
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <EditorToolbar editor={editor} />
        <EditorContent
          className={cn(
            "[&_.ProseMirror]:min-h-[inherit]",
            maxHeight && "overflow-y-auto",
            contentClassName
          )}
          editor={editor}
          style={{ maxHeight, minHeight }}
        />
      </div>
    )
  }
)

MarkdownEditor.displayName = "MarkdownEditor"
