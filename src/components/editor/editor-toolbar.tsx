import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Editor } from "@tiptap/react"
import {
  Bold,
  Check,
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
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type ToolbarItem = {
  action: () => void
  group: number
  icon: React.ReactNode
  id: string
  isActive?: () => boolean
  label: string
  width?: number
}

export function EditorToolbar({ editor }: { editor: Editor | null }) {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [overflowItems, setOverflowItems] = useState<ToolbarItem[]>([])
  const [visibleItems, setVisibleItems] = useState<ToolbarItem[]>([])
  const [linkUrl, setLinkUrl] = useState("")
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false)
  const [, setEditorStateVersion] = useState(0)
  const toggleButtonIds = new Set([
    "bold",
    "italic",
    "underline",
    "strike",
    "code",
    "codeBlock",
    "blockquote",
    "bulletList",
    "orderedList",
  ])

  const chain = () => editor?.chain().focus() as any
  const isEditorActive = (name: string, attributes?: Record<string, unknown>) =>
    Boolean(
      editor?.isFocused &&
      (attributes ? editor.isActive(name, attributes) : editor.isActive(name))
    )
  const getCurrentBlockLabel = () => {
    if (!editor?.isFocused) return "H"
    if (editor.isActive("heading", { level: 1 })) return "H1"
    if (editor.isActive("heading", { level: 2 })) return "H2"
    if (editor.isActive("heading", { level: 3 })) return "H3"
    return "Body"
  }
  const isBodyActive = () =>
    Boolean(
      editor?.isFocused &&
      !editor.isActive("heading") &&
      !editor.isActive("blockquote") &&
      !editor.isActive("bulletList") &&
      !editor.isActive("orderedList") &&
      !editor.isActive("codeBlock")
    )

  const items: ToolbarItem[] = useMemo(
    () =>
      editor
        ? [
            {
              action: () => chain()?.toggleBold().run(),
              group: 1,
              icon: <Bold size={16} />,
              id: "bold",
              isActive: () => isEditorActive("bold"),
              label: "Bold",
            },
            {
              action: () => chain()?.toggleItalic().run(),
              group: 1,
              icon: <Italic size={16} />,
              id: "italic",
              isActive: () => isEditorActive("italic"),
              label: "Italic",
            },
            {
              action: () => chain()?.toggleUnderline().run(),
              group: 1,
              icon: <Underline size={16} />,
              id: "underline",
              isActive: () => isEditorActive("underline"),
              label: "Underline",
            },
            {
              action: () => chain()?.toggleStrike().run(),
              group: 1,
              icon: <Strikethrough size={16} />,
              id: "strike",
              isActive: () => isEditorActive("strike"),
              label: "Strikethrough",
            },
            {
              action: () => {
                const previousUrl = editor.getAttributes("link").href
                setLinkUrl(previousUrl || "")
                setLinkPopoverOpen(true)
              },
              group: 2,
              icon: <Link size={16} />,
              id: "link",
              isActive: () => isEditorActive("link"),
              label: "Link",
            },
            {
              action: () => chain()?.toggleCode().run(),
              group: 3,
              icon: <Code size={16} />,
              id: "code",
              isActive: () => isEditorActive("code"),
              label: "Inline Code",
            },
            {
              action: () => chain()?.toggleCodeBlock().run(),
              group: 3,
              icon: <Code2 size={16} />,
              id: "codeBlock",
              isActive: () => isEditorActive("codeBlock"),
              label: "Code Block",
            },
            {
              action: () => chain()?.toggleBlockquote().run(),
              group: 4,
              icon: <Quote size={16} />,
              id: "blockquote",
              isActive: () => isEditorActive("blockquote"),
              label: "Quote",
            },
            {
              action: () => chain()?.toggleBulletList().run(),
              group: 5,
              icon: <List size={16} />,
              id: "bulletList",
              isActive: () => isEditorActive("bulletList"),
              label: "Bullet List",
            },
            {
              action: () => chain()?.toggleOrderedList().run(),
              group: 5,
              icon: <ListOrdered size={16} />,
              id: "orderedList",
              isActive: () => isEditorActive("orderedList"),
              label: "Numbered List",
            },
            {
              action: () => {},
              group: 6,
              icon: <Heading size={16} />,
              id: "heading",
              isActive: () => isEditorActive("heading"),
              label: "Heading",
              width: 56,
            },
          ]
        : [],
    [editor]
  )

  const calculateOverflow = useCallback(() => {
    if (!toolbarRef.current) return
    const containerWidth = toolbarRef.current.offsetWidth
    const defaultButtonWidth = 36
    const dividerWidth = 17
    const overflowButtonWidth = 40
    const padding = 8

    let usedWidth = padding + overflowButtonWidth
    let lastGroup = 0
    const visible: ToolbarItem[] = []
    const overflow: ToolbarItem[] = []

    for (const item of items) {
      if (item.group !== lastGroup && lastGroup !== 0) usedWidth += dividerWidth
      const itemWidth = item.width ?? defaultButtonWidth
      if (usedWidth + itemWidth <= containerWidth) {
        visible.push(item)
        usedWidth += itemWidth
      } else {
        overflow.push(item)
      }
      lastGroup = item.group
    }

    setVisibleItems(visible)
    setOverflowItems(overflow)
  }, [items])

  useEffect(() => {
    if (!editor) return

    const rerenderToolbar = () => {
      setEditorStateVersion((version) => version + 1)
    }

    editor.on("transaction", rerenderToolbar)
    editor.on("selectionUpdate", rerenderToolbar)
    editor.on("focus", rerenderToolbar)
    editor.on("blur", rerenderToolbar)

    return () => {
      editor.off("transaction", rerenderToolbar)
      editor.off("selectionUpdate", rerenderToolbar)
      editor.off("focus", rerenderToolbar)
      editor.off("blur", rerenderToolbar)
    }
  }, [editor])

  useEffect(() => {
    calculateOverflow()
    const resizeObserver = new ResizeObserver(calculateOverflow)
    if (toolbarRef.current) resizeObserver.observe(toolbarRef.current)
    return () => resizeObserver.disconnect()
  }, [calculateOverflow])

  const applyLink = () => {
    if (linkUrl) {
      chain()
        ?.extendMarkRange("link")
        .setLink({ href: linkUrl, target: "_blank" })
        .run()
    } else {
      chain()?.extendMarkRange("link").unsetLink().run()
    }
    setLinkPopoverOpen(false)
    setLinkUrl("")
  }

  if (!editor) return null

  const activeButtonClass =
    "border-border bg-accent text-accent-foreground shadow-xs"

  const renderItem = (item: ToolbarItem) => {
    if (item.id === "heading") {
      return (
        <DropdownMenu key={item.id}>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Text style: ${getCurrentBlockLabel()}`}
              className={cn(
                "h-8 min-w-14 gap-1.5 px-2",
                item.isActive?.() && activeButtonClass
              )}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Heading size={16} />
              <span className="text-[11px] font-semibold tracking-wide">
                {getCurrentBlockLabel()}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              className={cn(isBodyActive() && "font-medium")}
              onClick={() => chain()?.setParagraph().run()}
            >
              <Check
                className={cn(
                  "mr-2 size-4",
                  isBodyActive() ? "opacity-100" : "opacity-0"
                )}
              />
              Body
            </DropdownMenuItem>
            <DropdownMenuItem
              className={cn(
                isEditorActive("heading", { level: 1 }) && "font-medium"
              )}
              onClick={() => chain()?.toggleHeading({ level: 1 }).run()}
            >
              <Check
                className={cn(
                  "mr-2 size-4",
                  isEditorActive("heading", { level: 1 })
                    ? "opacity-100"
                    : "opacity-0"
                )}
              />
              Heading 1
            </DropdownMenuItem>
            <DropdownMenuItem
              className={cn(
                isEditorActive("heading", { level: 2 }) && "font-medium"
              )}
              onClick={() => chain()?.toggleHeading({ level: 2 }).run()}
            >
              <Check
                className={cn(
                  "mr-2 size-4",
                  isEditorActive("heading", { level: 2 })
                    ? "opacity-100"
                    : "opacity-0"
                )}
              />
              Heading 2
            </DropdownMenuItem>
            <DropdownMenuItem
              className={cn(
                isEditorActive("heading", { level: 3 }) && "font-medium"
              )}
              onClick={() => chain()?.toggleHeading({ level: 3 }).run()}
            >
              <Check
                className={cn(
                  "mr-2 size-4",
                  isEditorActive("heading", { level: 3 })
                    ? "opacity-100"
                    : "opacity-0"
                )}
              />
              Heading 3
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }

    if (item.id === "link") {
      return (
        <Popover
          key={item.id}
          onOpenChange={setLinkPopoverOpen}
          open={linkPopoverOpen}
        >
          <PopoverTrigger asChild>
            <Button
              aria-label={item.label}
              className={cn(
                "h-8 w-8 p-0",
                item.isActive?.() && activeButtonClass
              )}
              onClick={item.action}
              size="sm"
              type="button"
              variant="ghost"
            >
              {item.icon}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Link URL</label>
              <input
                className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
                onChange={(event) => setLinkUrl(event.target.value)}
                placeholder="https://example.com"
                value={linkUrl}
              />
              <div className="flex gap-2">
                <Button onClick={applyLink} size="sm" type="button">
                  Apply
                </Button>
                <Button
                  onClick={() => {
                    chain()?.extendMarkRange("link").unsetLink().run()
                    setLinkPopoverOpen(false)
                    setLinkUrl("")
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Remove
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )
    }

    return (
      <Button
        aria-label={item.label}
        aria-pressed={
          toggleButtonIds.has(item.id) ? item.isActive?.() : undefined
        }
        key={item.id}
        className={cn("h-8 w-8 p-0", item.isActive?.() && activeButtonClass)}
        onClick={item.action}
        size="sm"
        title={item.label}
        type="button"
        variant="ghost"
      >
        {item.icon}
      </Button>
    )
  }

  const groupedVisible: React.ReactNode[] = []
  let lastGroup = 0
  visibleItems.forEach((item, index) => {
    if (item.group !== lastGroup && lastGroup !== 0) {
      groupedVisible.push(
        <div key={`divider-${index}`} className="mx-1 h-6 w-px bg-border" />
      )
    }
    groupedVisible.push(renderItem(item))
    lastGroup = item.group
  })

  return (
    <div className="border-b bg-muted/30 px-2 py-1">
      <div className="flex items-center" ref={toolbarRef}>
        {groupedVisible}
        {overflowItems.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="ml-auto h-8 w-8 p-0"
                size="sm"
                type="button"
                variant="ghost"
              >
                <MoreHorizontal size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {overflowItems.map((item) => (
                <DropdownMenuItem
                  className={cn(item.isActive?.() && "font-medium")}
                  key={item.id}
                  onClick={item.action}
                >
                  {item.id !== "heading" ? (
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        item.isActive?.() ? "opacity-100" : "opacity-0"
                      )}
                    />
                  ) : null}
                  {item.icon}
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  )
}
