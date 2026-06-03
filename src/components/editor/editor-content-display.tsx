import { startTransition, useEffect, useMemo, useState } from "react"

import { cn } from "@/lib/utils"

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
  const [processedContent, setProcessedContent] = useState(baseContent)

  useEffect(() => {
    let isCancelled = false

    if (!isHTML) {
      setProcessedContent(content)
      return () => {
        isCancelled = true
      }
    }

    setProcessedContent(baseContent)

    if (!baseContent.includes("<pre") || !baseContent.includes("<code")) {
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
  }, [baseContent, content, isHTML])

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
