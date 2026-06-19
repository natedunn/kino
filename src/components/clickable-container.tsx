// components/ClickableCard.tsx
import { forwardRef, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"

interface ClickableContainerProps {
  onClick: () => void
  children: React.ReactNode
  className?: string
  href?: string
  keyboardInteractive?: boolean
  "aria-label"?: string
  "aria-labelledby"?: string
  "aria-describedby"?: string
  disabled?: boolean
}

const interactiveSelector = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  '[role="button"]',
  '[role="link"]',
].join(",")

export const ClickableContainer = forwardRef<
  HTMLDivElement,
  ClickableContainerProps
>(
  (
    {
      onClick,
      children,
      className = "",
      href,
      keyboardInteractive = true,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      "aria-describedby": ariaDescribedBy,
      disabled = false,
      ...props
    },
    ref
  ) => {
    const [hasActiveSelection, setHasActiveSelection] = useState(false)
    const [showContextLink, setShowContextLink] = useState(false)
    const mouseStartPos = useRef<{ x: number; y: number } | null>(null)
    const contextLinkTimeout = useRef<ReturnType<typeof setTimeout> | null>(
      null
    )

    useEffect(() => {
      return () => {
        if (contextLinkTimeout.current) {
          clearTimeout(contextLinkTimeout.current)
        }
      }
    }, [])

    const hideContextLink = () => {
      if (contextLinkTimeout.current) {
        clearTimeout(contextLinkTimeout.current)
        contextLinkTimeout.current = null
      }

      setShowContextLink(false)
    }

    const handlePointerDownCapture = (e: React.PointerEvent) => {
      if (!href || disabled) return

      const isContextMenuPointerDown =
        e.button === 2 || (e.button === 0 && e.ctrlKey)
      if (!isContextMenuPointerDown) return

      flushSync(() => {
        setShowContextLink(true)
      })

      if (contextLinkTimeout.current) {
        clearTimeout(contextLinkTimeout.current)
      }

      contextLinkTimeout.current = setTimeout(() => {
        setShowContextLink(false)
        contextLinkTimeout.current = null
      }, 2000)
    }

    const handleMouseDown = (e: React.MouseEvent) => {
      mouseStartPos.current = { x: e.clientX, y: e.clientY }
      setHasActiveSelection(false)
    }

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!mouseStartPos.current) return

      const moved =
        Math.abs(e.clientX - mouseStartPos.current.x) > 3 ||
        Math.abs(e.clientY - mouseStartPos.current.y) > 3

      if (moved) {
        setHasActiveSelection(true)
      }
    }

    const handleMouseUp = () => {
      setTimeout(() => {
        const selection = window.getSelection()
        const hasSelection =
          selection && selection.toString().length > 0 ? true : false
        setHasActiveSelection(hasSelection)
      }, 10)
    }

    const handleClick = (e: React.MouseEvent) => {
      if (disabled || hasActiveSelection) {
        return
      }

      // Don't navigate if clicking on interactive elements
      const target = e.target as HTMLElement
      const interactiveElement = target.closest(interactiveSelector)
      if (interactiveElement && interactiveElement !== e.currentTarget) {
        return
      }

      onClick()
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        onClick()
      }
    }

    const handleContextLinkContextMenu = () => {
      setTimeout(hideContextLink, 0)
    }

    return (
      <div
        ref={ref}
        role={keyboardInteractive ? "button" : undefined}
        tabIndex={keyboardInteractive ? (disabled ? -1 : 0) : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-disabled={keyboardInteractive ? disabled : undefined}
        onClick={handleClick}
        onContextMenuCapture={handleContextLinkContextMenu}
        onKeyDown={keyboardInteractive ? handleKeyDown : undefined}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onPointerDownCapture={handlePointerDownCapture}
        className={`relative ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${className} `}
        {...props}
      >
        {children}
        {href && showContextLink ? (
          <a
            aria-hidden="true"
            className="absolute inset-0 z-10 cursor-pointer"
            draggable={false}
            href={href}
            onContextMenu={handleContextLinkContextMenu}
            tabIndex={-1}
          />
        ) : null}
      </div>
    )
  }
)

ClickableContainer.displayName = "ClickableContainer"
