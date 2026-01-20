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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain = () => editor?.chain().focus() as any;

  const items: ToolbarItem[] = useMemo(() => editor
    ? [
        {
          id: 'bold',
          icon: <Bold size={16} />,
          label: 'Bold',
          action: () => chain()?.toggleBold().run(),
          isActive: () => editor.isActive('bold'),
          group: 1,
        },
        {
          id: 'italic',
          icon: <Italic size={16} />,
          label: 'Italic',
          action: () => chain()?.toggleItalic().run(),
          isActive: () => editor.isActive('italic'),
          group: 1,
        },
        {
          id: 'underline',
          icon: <Underline size={16} />,
          label: 'Underline',
          action: () => chain()?.toggleUnderline().run(),
          isActive: () => editor.isActive('underline'),
          group: 1,
        },
        {
          id: 'strike',
          icon: <Strikethrough size={16} />,
          label: 'Strikethrough',
          action: () => chain()?.toggleStrike().run(),
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
          action: () => chain()?.toggleCode().run(),
          isActive: () => editor.isActive('code'),
          group: 3,
        },
        {
          id: 'codeBlock',
          icon: <Code2 size={16} />,
          label: 'Code Block',
          action: () => chain()?.toggleCodeBlock().run(),
          isActive: () => editor.isActive('codeBlock'),
          group: 3,
        },
        {
          id: 'blockquote',
          icon: <Quote size={16} />,
          label: 'Quote',
          action: () => chain()?.toggleBlockquote().run(),
          isActive: () => editor.isActive('blockquote'),
          group: 4,
        },
        {
          id: 'bulletList',
          icon: <List size={16} />,
          label: 'Bullet List',
          action: () => chain()?.toggleBulletList().run(),
          isActive: () => editor.isActive('bulletList'),
          group: 5,
        },
        {
          id: 'orderedList',
          icon: <ListOrdered size={16} />,
          label: 'Numbered List',
          action: () => chain()?.toggleOrderedList().run(),
          isActive: () => editor.isActive('orderedList'),
          group: 5,
        },
        {
          id: 'heading',
          icon: <Heading size={16} />,
          label: 'Heading',
          action: () => {},
          isActive: () =>
            editor.isActive('heading', { level: 4 }) ||
            editor.isActive('heading', { level: 5 }) ||
            editor.isActive('heading', { level: 6 }),
          group: 6,
        },
      ]
    : [],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [editor]);

  const calculateOverflow = useCallback(() => {
    if (!toolbarRef.current) return;

    const containerWidth = toolbarRef.current.offsetWidth;
    const buttonWidth = 36;
    const dividerWidth = 17;
    const overflowButtonWidth = 40;
    const padding = 8;

    let usedWidth = padding + overflowButtonWidth;
    let lastGroup = 0;
    const visible: ToolbarItem[] = [];
    const overflow: ToolbarItem[] = [];

    for (const item of items) {
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
      chain()?.extendMarkRange('link').setLink({ href: linkUrl, target: '_blank' }).run();
    } else {
      chain()?.extendMarkRange('link').unsetLink().run();
    }
    setLinkPopoverOpen(false);
    setLinkUrl('');
  };

  if (!editor) return null;

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
                className={cn('h-8 w-8 p-0', item.isActive?.() && 'bg-accent')}
              >
                {item.icon}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => chain()?.toggleHeading({ level: 4 }).run()}>
                Heading 1
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => chain()?.toggleHeading({ level: 5 }).run()}>
                Heading 2
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => chain()?.toggleHeading({ level: 6 }).run()}>
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
