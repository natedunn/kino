import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
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
  action: () => void;
  group: number;
  icon: React.ReactNode;
  id: string;
  isActive?: () => boolean;
  label: string;
};

export function EditorToolbar({ editor }: { editor: Editor | null }) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [overflowItems, setOverflowItems] = useState<ToolbarItem[]>([]);
  const [visibleItems, setVisibleItems] = useState<ToolbarItem[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);

  const chain = () => editor?.chain().focus() as any;

  const items: ToolbarItem[] = useMemo(
    () =>
      editor
        ? [
            { action: () => chain()?.toggleBold().run(), group: 1, icon: <Bold size={16} />, id: 'bold', isActive: () => editor.isActive('bold'), label: 'Bold' },
            { action: () => chain()?.toggleItalic().run(), group: 1, icon: <Italic size={16} />, id: 'italic', isActive: () => editor.isActive('italic'), label: 'Italic' },
            { action: () => chain()?.toggleUnderline().run(), group: 1, icon: <Underline size={16} />, id: 'underline', isActive: () => editor.isActive('underline'), label: 'Underline' },
            { action: () => chain()?.toggleStrike().run(), group: 1, icon: <Strikethrough size={16} />, id: 'strike', isActive: () => editor.isActive('strike'), label: 'Strikethrough' },
            {
              action: () => {
                const previousUrl = editor.getAttributes('link').href;
                setLinkUrl(previousUrl || '');
                setLinkPopoverOpen(true);
              },
              group: 2,
              icon: <Link size={16} />,
              id: 'link',
              isActive: () => editor.isActive('link'),
              label: 'Link',
            },
            { action: () => chain()?.toggleCode().run(), group: 3, icon: <Code size={16} />, id: 'code', isActive: () => editor.isActive('code'), label: 'Inline Code' },
            { action: () => chain()?.toggleCodeBlock().run(), group: 3, icon: <Code2 size={16} />, id: 'codeBlock', isActive: () => editor.isActive('codeBlock'), label: 'Code Block' },
            { action: () => chain()?.toggleBlockquote().run(), group: 4, icon: <Quote size={16} />, id: 'blockquote', isActive: () => editor.isActive('blockquote'), label: 'Quote' },
            { action: () => chain()?.toggleBulletList().run(), group: 5, icon: <List size={16} />, id: 'bulletList', isActive: () => editor.isActive('bulletList'), label: 'Bullet List' },
            { action: () => chain()?.toggleOrderedList().run(), group: 5, icon: <ListOrdered size={16} />, id: 'orderedList', isActive: () => editor.isActive('orderedList'), label: 'Numbered List' },
            {
              action: () => {},
              group: 6,
              icon: <Heading size={16} />,
              id: 'heading',
              isActive: () =>
                editor.isActive('heading', { level: 4 }) ||
                editor.isActive('heading', { level: 5 }) ||
                editor.isActive('heading', { level: 6 }),
              label: 'Heading',
            },
          ]
        : [],
    [editor]
  );

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
      if (item.group !== lastGroup && lastGroup !== 0) usedWidth += dividerWidth;
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
    if (toolbarRef.current) resizeObserver.observe(toolbarRef.current);
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

  const renderItem = (item: ToolbarItem) => {
    if (item.id === 'heading') {
      return (
        <DropdownMenu key={item.id}>
          <DropdownMenuTrigger asChild>
            <Button className={cn('h-8 w-8 p-0', item.isActive?.() && 'bg-accent')} size="sm" type="button" variant="ghost">
              {item.icon}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => chain()?.toggleHeading({ level: 4 }).run()}>Heading 1</DropdownMenuItem>
            <DropdownMenuItem onClick={() => chain()?.toggleHeading({ level: 5 }).run()}>Heading 2</DropdownMenuItem>
            <DropdownMenuItem onClick={() => chain()?.toggleHeading({ level: 6 }).run()}>Heading 3</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    if (item.id === 'link') {
      return (
        <Popover key={item.id} onOpenChange={setLinkPopoverOpen} open={linkPopoverOpen}>
          <PopoverTrigger asChild>
            <Button className={cn('h-8 w-8 p-0', item.isActive?.() && 'bg-accent')} onClick={item.action} size="sm" type="button" variant="ghost">
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
                    chain()?.extendMarkRange('link').unsetLink().run();
                    setLinkPopoverOpen(false);
                    setLinkUrl('');
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
      );
    }

    return (
      <Button
        key={item.id}
        className={cn('h-8 w-8 p-0', item.isActive?.() && 'bg-accent')}
        onClick={item.action}
        size="sm"
        title={item.label}
        type="button"
        variant="ghost"
      >
        {item.icon}
      </Button>
    );
  };

  const groupedVisible: React.ReactNode[] = [];
  let lastGroup = 0;
  visibleItems.forEach((item, index) => {
    if (item.group !== lastGroup && lastGroup !== 0) {
      groupedVisible.push(<div key={`divider-${index}`} className="mx-1 h-6 w-px bg-border" />);
    }
    groupedVisible.push(renderItem(item));
    lastGroup = item.group;
  });

  return (
    <div className="border-b bg-muted/30 px-2 py-1">
      <div className="flex items-center" ref={toolbarRef}>
        {groupedVisible}
        {overflowItems.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="ml-auto h-8 w-8 p-0" size="sm" type="button" variant="ghost">
                <MoreHorizontal size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {overflowItems.map((item) => (
                <DropdownMenuItem key={item.id} onClick={item.action}>
                  {item.icon}
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
