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
  const [processedContent, setProcessedContent] = useState(immediateContent)

  useEffect(() => {
    let isCancelled = false

    if (!isHTML) {
      setProcessedContent(content)
      return () => {
        isCancelled = true
      }
    }

    setProcessedContent(immediateContent)

    if (!hasCodeBlock) {
      return () => {
        isCancelled = true
      }
    }

    void import("./format-content-for-display").then(
      ({ formatContentForDisplay }) => {
        if (isCancelled) return

        startTransition(() => {
          setProcessedContent(formatContentForDisplay(baseContent))
        })
      }
    )

    return () => {
      isCancelled = true
    }
  }, [baseContent, hasCodeBlock, immediateContent, isHTML])

  if (!isHTML) {
    return <div className={cn("whitespace-pre-wrap", className)}>{content}</div>
  }

  return (
    <div
      className={cn("markdown-prose pb-1", className)}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  )
}
