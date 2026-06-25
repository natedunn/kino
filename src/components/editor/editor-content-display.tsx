import { startTransition, useEffect, useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import { formatInlineCode } from "./format-inline-code"
import { sanitizeEditorContent } from "./sanitize-content"

type EditorContentDisplayProps = {
  className?: string
  content: string
}

export function EditorContentDisplay({
  className,
  content,
}: EditorContentDisplayProps) {
  const isHTML = content.startsWith("<") && content.includes("</")
  const baseContent = useMemo(
    () => (isHTML ? sanitizeEditorContent(content) : content),
    [content, isHTML]
  )
  const hasCodeBlock =
    baseContent.includes("<pre") && baseContent.includes("<code")
  const hasInlineBackticks = baseContent.includes("`")
  const immediateContent = useMemo(() => {
    if (!isHTML) return content
    if (hasCodeBlock) return baseContent
    return hasInlineBackticks ? formatInlineCode(baseContent) : baseContent
  }, [baseContent, content, hasCodeBlock, hasInlineBackticks, isHTML])

  // Only code blocks need async syntax highlighting. Everything else renders
  // `immediateContent` directly (no state write). `highlighted` holds the
  // lazily-loaded highlighted HTML once it resolves, and falls back to
  // `immediateContent` until then.
  const [highlighted, setHighlighted] = useState<string | null>(null)

  useEffect(() => {
    // Reset to the immediate (unhighlighted) content whenever the source
    // changes; this is a no-op render when it's already null.
    setHighlighted(null)
    if (!isHTML || !hasCodeBlock) return

    let isCancelled = false
    void import("./format-content-for-display").then(
      ({ formatContentForDisplay }) => {
        if (isCancelled) return

        startTransition(() => {
          setHighlighted(formatContentForDisplay(baseContent))
        })
      }
    )

    return () => {
      isCancelled = true
    }
  }, [baseContent, hasCodeBlock, isHTML])

  if (!isHTML) {
    return <div className={cn("whitespace-pre-wrap", className)}>{content}</div>
  }

  return (
    <div
      className={cn("markdown-prose pb-1", className)}
      dangerouslySetInnerHTML={{ __html: highlighted ?? immediateContent }}
    />
  )
}
