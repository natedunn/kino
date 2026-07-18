
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditorState } from '@tiptap/react';
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
} from 'lucide-react';
import type { Editor } from '@tiptap/react';

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
	label: string;
	width?: number;
};

// Active-state flags the toolbar cares about. Kept as a flat, plain-boolean
// shape so useEditorState's default deep-equality check can cheaply decide
// whether anything the toolbar renders actually changed.
const EMPTY_FLAGS = {
	blockquote: false,
	bold: false,
	bulletList: false,
	code: false,
	codeBlock: false,
	heading: false,
	heading1: false,
	heading2: false,
	heading3: false,
	italic: false,
	link: false,
	orderedList: false,
	strike: false,
	underline: false,
};

type FlagKey = keyof typeof EMPTY_FLAGS;

export function EditorToolbar({ editor }: { editor: Editor | null }) {
	const toolbarRef = useRef<HTMLDivElement>(null);
	const [overflowItems, setOverflowItems] = useState<Array<ToolbarItem>>([]);
	const [visibleItems, setVisibleItems] = useState<Array<ToolbarItem>>([]);
	const [linkUrl, setLinkUrl] = useState('');
	const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
	const toggleButtonIds = new Set([
		'bold',
		'italic',
		'underline',
		'strike',
		'code',
		'codeBlock',
		'blockquote',
		'bulletList',
		'orderedList',
	]);

	// Reactive active-state, scoped to just the flags above. useEditorState only
	// re-renders the toolbar when this object changes (deep-equal), so typing
	// plain text that doesn't cross a formatting boundary costs nothing here —
	// while still updating the moment the cursor enters/leaves bold, a heading,
	// a list, etc.
	const flags =
		useEditorState({
			editor,
			selector: ({ editor: activeEditor }) =>
				activeEditor
					? {
							blockquote: activeEditor.isActive('blockquote'),
							bold: activeEditor.isActive('bold'),
							bulletList: activeEditor.isActive('bulletList'),
							code: activeEditor.isActive('code'),
							codeBlock: activeEditor.isActive('codeBlock'),
							heading: activeEditor.isActive('heading'),
							heading1: activeEditor.isActive('heading', { level: 1 }),
							heading2: activeEditor.isActive('heading', { level: 2 }),
							heading3: activeEditor.isActive('heading', { level: 3 }),
							italic: activeEditor.isActive('italic'),
							link: activeEditor.isActive('link'),
							orderedList: activeEditor.isActive('orderedList'),
							strike: activeEditor.isActive('strike'),
							underline: activeEditor.isActive('underline'),
						}
					: EMPTY_FLAGS,
		}) ?? EMPTY_FLAGS;

	// Focus/blur don't always dispatch a transaction, so useEditorState won't
	// catch them — track them separately to keep the "dim when unfocused"
	// behavior. These fire rarely (not per keystroke), so the extra render is
	// negligible.
	const [, setFocusTick] = useState(0);
	useEffect(() => {
		if (!editor) return;
		const handleFocusChange = () => setFocusTick((tick) => tick + 1);
		editor.on('focus', handleFocusChange);
		editor.on('blur', handleFocusChange);
		return () => {
			editor.off('focus', handleFocusChange);
			editor.off('blur', handleFocusChange);
		};
	}, [editor]);

	const isFocused = editor?.isFocused ?? false;
	const isFlagActive = (key: FlagKey) => isFocused && flags[key];

	const chain = useCallback(() => editor?.chain().focus() as any, [editor]);

	const getCurrentBlockLabel = () => {
		if (!isFocused) return 'H';
		if (flags.heading1) return 'H1';
		if (flags.heading2) return 'H2';
		if (flags.heading3) return 'H3';
		return 'Body';
	};
	const isBodyActive = () =>
		isFocused &&
		!flags.heading &&
		!flags.blockquote &&
		!flags.bulletList &&
		!flags.orderedList &&
		!flags.codeBlock;

	// Only structural data lives in the memo (actions/icons/labels). Active state
	// is read live from `flags` at render time — never captured here, or the
	// memo would freeze it at first render.
	const items: Array<ToolbarItem> = useMemo(
		() =>
			editor
				? [
						{
							action: () => chain()?.toggleBold().run(),
							group: 1,
							icon: <Bold size={16} />,
							id: 'bold',
							label: 'Bold',
						},
						{
							action: () => chain()?.toggleItalic().run(),
							group: 1,
							icon: <Italic size={16} />,
							id: 'italic',
							label: 'Italic',
						},
						{
							action: () => chain()?.toggleUnderline().run(),
							group: 1,
							icon: <Underline size={16} />,
							id: 'underline',
							label: 'Underline',
						},
						{
							action: () => chain()?.toggleStrike().run(),
							group: 1,
							icon: <Strikethrough size={16} />,
							id: 'strike',
							label: 'Strikethrough',
						},
						{
							action: () => {
								const previousUrl = editor.getAttributes('link').href;
								setLinkUrl(previousUrl || '');
								setLinkPopoverOpen(true);
							},
							group: 2,
							icon: <Link size={16} />,
							id: 'link',
							label: 'Link',
						},
						{
							action: () => chain()?.toggleCode().run(),
							group: 3,
							icon: <Code size={16} />,
							id: 'code',
							label: 'Inline Code',
						},
						{
							action: () => chain()?.toggleCodeBlock().run(),
							group: 3,
							icon: <Code2 size={16} />,
							id: 'codeBlock',
							label: 'Code Block',
						},
						{
							action: () => chain()?.toggleBlockquote().run(),
							group: 4,
							icon: <Quote size={16} />,
							id: 'blockquote',
							label: 'Quote',
						},
						{
							action: () => chain()?.toggleBulletList().run(),
							group: 5,
							icon: <List size={16} />,
							id: 'bulletList',
							label: 'Bullet List',
						},
						{
							action: () => chain()?.toggleOrderedList().run(),
							group: 5,
							icon: <ListOrdered size={16} />,
							id: 'orderedList',
							label: 'Numbered List',
						},
						{
							action: () => {},
							group: 6,
							icon: <Heading size={16} />,
							id: 'heading',
							label: 'Heading',
							width: 56,
						},
					]
				: [],
		[editor, chain]
	);

	const calculateOverflow = useCallback(() => {
		if (!toolbarRef.current) return;
		const containerWidth = toolbarRef.current.offsetWidth;
		const defaultButtonWidth = 36;
		const dividerWidth = 17;
		const overflowButtonWidth = 40;
		const padding = 8;

		let usedWidth = padding + overflowButtonWidth;
		let lastGroup = 0;
		const visible: Array<ToolbarItem> = [];
		const overflow: Array<ToolbarItem> = [];

		for (const item of items) {
			if (item.group !== lastGroup && lastGroup !== 0) usedWidth += dividerWidth;
			const itemWidth = item.width ?? defaultButtonWidth;
			if (usedWidth + itemWidth <= containerWidth) {
				visible.push(item);
				usedWidth += itemWidth;
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

	const activeButtonClass = 'border-border bg-accent text-accent-foreground shadow-xs';

	const renderItem = (item: ToolbarItem) => {
		if (item.id === 'heading') {
			return (
				<DropdownMenu key={item.id}>
					<DropdownMenuTrigger asChild>
						<Button
							aria-label={`Text style: ${getCurrentBlockLabel()}`}
							className={cn(
								'h-8 min-w-14 gap-1.5 px-2',
								isFlagActive('heading') && activeButtonClass
							)}
							size='sm'
							type='button'
							variant='ghost'
						>
							<Heading size={16} />
							<span className='text-[11px] font-semibold tracking-wide'>
								{getCurrentBlockLabel()}
							</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuItem
							className={cn(isBodyActive() && 'font-medium')}
							onClick={() => chain()?.setParagraph().run()}
						>
							<Check className={cn('mr-2 size-4', isBodyActive() ? 'opacity-100' : 'opacity-0')} />
							Body
						</DropdownMenuItem>
						<DropdownMenuItem
							className={cn(isFlagActive('heading1') && 'font-medium')}
							onClick={() => chain()?.toggleHeading({ level: 1 }).run()}
						>
							<Check
								className={cn(
									'mr-2 size-4',
									isFlagActive('heading1') ? 'opacity-100' : 'opacity-0'
								)}
							/>
							Heading 1
						</DropdownMenuItem>
						<DropdownMenuItem
							className={cn(isFlagActive('heading2') && 'font-medium')}
							onClick={() => chain()?.toggleHeading({ level: 2 }).run()}
						>
							<Check
								className={cn(
									'mr-2 size-4',
									isFlagActive('heading2') ? 'opacity-100' : 'opacity-0'
								)}
							/>
							Heading 2
						</DropdownMenuItem>
						<DropdownMenuItem
							className={cn(isFlagActive('heading3') && 'font-medium')}
							onClick={() => chain()?.toggleHeading({ level: 3 }).run()}
						>
							<Check
								className={cn(
									'mr-2 size-4',
									isFlagActive('heading3') ? 'opacity-100' : 'opacity-0'
								)}
							/>
							Heading 3
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			);
		}

		if (item.id === 'link') {
			return (
				<Popover key={item.id} onOpenChange={setLinkPopoverOpen} open={linkPopoverOpen}>
					<PopoverTrigger asChild>
						<Button
							aria-label={item.label}
							className={cn('h-8 w-8 p-0', isFlagActive('link') && activeButtonClass)}
							onClick={item.action}
							size='sm'
							type='button'
							variant='ghost'
						>
							{item.icon}
						</Button>
					</PopoverTrigger>
					<PopoverContent className='w-80'>
						<div className='flex flex-col gap-2'>
							<label className='text-sm font-medium'>Link URL</label>
							<input
								className='h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none'
								onChange={(event) => setLinkUrl(event.target.value)}
								placeholder='https://example.com'
								value={linkUrl}
							/>
							<div className='flex gap-2'>
								<Button onClick={applyLink} size='sm' type='button'>
									Apply
								</Button>
								<Button
									onClick={() => {
										chain()?.extendMarkRange('link').unsetLink().run();
										setLinkPopoverOpen(false);
										setLinkUrl('');
									}}
									size='sm'
									type='button'
									variant='outline'
								>
									Remove
								</Button>
							</div>
						</div>
					</PopoverContent>
				</Popover>
			);
		}

		const active = isFlagActive(item.id as FlagKey);
		return (
			<Button
				aria-label={item.label}
				aria-pressed={toggleButtonIds.has(item.id) ? active : undefined}
				key={item.id}
				className={cn('h-8 w-8 p-0', active && activeButtonClass)}
				onClick={item.action}
				size='sm'
				title={item.label}
				type='button'
				variant='ghost'
			>
				{item.icon}
			</Button>
		);
	};

	const groupedVisible: Array<React.ReactNode> = [];
	let lastGroup = 0;
	visibleItems.forEach((item, index) => {
		if (item.group !== lastGroup && lastGroup !== 0) {
			groupedVisible.push(<div key={`divider-${index}`} className='mx-1 h-6 w-px bg-border' />);
		}
		groupedVisible.push(renderItem(item));
		lastGroup = item.group;
	});

	return (
		<div className='border-b bg-muted/30 px-2 py-1'>
			<div className='flex items-center' ref={toolbarRef}>
				{groupedVisible}
				{overflowItems.length > 0 ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button className='ml-auto h-8 w-8 p-0' size='sm' type='button' variant='ghost'>
								<MoreHorizontal size={16} />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align='end'>
							{overflowItems.map((item) => {
								const active = isFlagActive(item.id as FlagKey);
								return (
									<DropdownMenuItem
										className={cn(active && 'font-medium')}
										key={item.id}
										onClick={item.action}
									>
										{item.id !== 'heading' ? (
											<Check className={cn('mr-2 size-4', active ? 'opacity-100' : 'opacity-0')} />
										) : null}
										{item.icon}
										{item.label}
									</DropdownMenuItem>
								);
							})}
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
			</div>
		</div>
	);
}
