import type { ReactNode } from 'react';

import {
	Bold,
	Code,
	Code2,
	Heading,
	Italic,
	Link,
	List,
	ListOrdered,
	Quote,
	Strikethrough,
	Underline,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Mirrors the button order and groups in `EditorToolbar`.
const TOOLBAR_GROUPS: Array<Array<{ icon: ReactNode; id: string }>> = [
	[
		{ icon: <Bold size={16} />, id: 'bold' },
		{ icon: <Italic size={16} />, id: 'italic' },
		{ icon: <Underline size={16} />, id: 'underline' },
		{ icon: <Strikethrough size={16} />, id: 'strike' },
	],
	[{ icon: <Link size={16} />, id: 'link' }],
	[
		{ icon: <Code size={16} />, id: 'code' },
		{ icon: <Code2 size={16} />, id: 'codeBlock' },
	],
	[{ icon: <Quote size={16} />, id: 'blockquote' }],
	[
		{ icon: <List size={16} />, id: 'bulletList' },
		{ icon: <ListOrdered size={16} />, id: 'orderedList' },
	],
];

/**
 * Inert, pixel-matched stand-in for `EditorToolbar`. Renders in the SSR HTML
 * and while the Tiptap chunk loads, so the real toolbar swaps in with no
 * visible change. Overflow is clipped instead of measured into a "more" menu.
 */
function EditorToolbarPlaceholder() {
	return (
		<div className='border-b bg-muted/30 px-2 py-1'>
			<div className='flex items-center overflow-hidden'>
				{TOOLBAR_GROUPS.map((group, index) => (
					<div className='flex shrink-0 items-center' key={group[0].id}>
						{index > 0 ? <div className='mx-1 h-6 w-px bg-border' /> : null}
						{group.map((item) => (
							<Button
								className='h-8 w-8 p-0'
								key={item.id}
								size='sm'
								tabIndex={-1}
								type='button'
								variant='ghost'
							>
								{item.icon}
							</Button>
						))}
					</div>
				))}
				<div className='mx-1 h-6 w-px shrink-0 bg-border' />
				<Button
					className='h-8 min-w-14 shrink-0 gap-1.5 px-2'
					size='sm'
					tabIndex={-1}
					type='button'
					variant='ghost'
				>
					<Heading size={16} />
					<span className='text-[11px] font-semibold tracking-wide'>H</span>
				</Button>
			</div>
		</div>
	);
}

/**
 * Static stand-in for `MarkdownEditor` with the same frame, toolbar, and
 * placeholder text. Used as the lazy chunk's fallback and for the editor's
 * first client render (Tiptap renders nothing until it has mounted).
 */
export function EditorPlaceholder({
	className,
	contentClassName,
	disabled = false,
	maxHeight,
	minHeight = '100px',
	placeholder = 'Write something...',
	value,
	variant = 'default',
}: {
	className?: string;
	contentClassName?: string;
	disabled?: boolean;
	maxHeight?: string;
	minHeight?: string;
	placeholder?: string;
	value?: string;
	variant?: 'borderless' | 'default';
}) {
	return (
		<div
			aria-hidden
			className={cn(
				'overflow-hidden rounded-md',
				variant === 'default' && ['border bg-white dark:bg-background', 'relative z-10'],
				disabled && 'cursor-not-allowed opacity-50',
				className
			)}
			inert
		>
			<EditorToolbarPlaceholder />
			<div
				className={cn(
					'[&_.ProseMirror]:min-h-[inherit]',
					maxHeight && 'overflow-y-auto',
					contentClassName
				)}
				style={{ maxHeight, minHeight }}
			>
				<div className='ProseMirror markdown-prose px-4 py-3'>
					<p className={value ? undefined : 'is-editor-empty'} data-placeholder={placeholder} />
				</div>
			</div>
		</div>
	);
}
