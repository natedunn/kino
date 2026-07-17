import type { ReactNode } from 'react';

import { useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * A live preview surface. Components are dropped in here on top of a subtle
 * dot grid so they read as "specimens" rather than page content.
 */
export function Preview({
	children,
	className,
	center,
}: {
	children: ReactNode;
	className?: string;
	/** Center the contents instead of the default left-aligned wrap. */
	center?: boolean;
}) {
	return (
		<div
			style={{
				backgroundImage:
					'radial-gradient(color-mix(in oklch, var(--foreground) 9%, transparent) 1px, transparent 1px)',
				backgroundSize: '16px 16px',
			}}
			className={cn(
				'relative flex min-h-32 flex-wrap gap-4 overflow-hidden rounded-xl border bg-background/60 p-6',
				center ? 'items-center justify-center' : 'items-center',
				className
			)}
		>
			{children}
		</div>
	);
}

/**
 * A labelled block within a component page: a small heading + caption above a
 * {@link Preview}. Most component pages are a stack of these.
 */
export function Demo({
	title,
	description,
	children,
	className,
	center,
}: {
	title?: string;
	description?: string;
	children: ReactNode;
	className?: string;
	center?: boolean;
}) {
	return (
		<section className='space-y-3'>
			{(title || description) && (
				<div className='space-y-0.5'>
					{title && <h3 className='text-sm font-medium tracking-tight'>{title}</h3>}
					{description && <p className='text-xs text-muted-foreground'>{description}</p>}
				</div>
			)}
			<Preview className={className} center={center}>
				{children}
			</Preview>
		</section>
	);
}

/**
 * A copy-to-clipboard code snippet. Used to show the import statement(s)
 * needed to use a component or example.
 */
export function CopySnippet({ code, className }: { code: string; className?: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			toast.success('Copied to clipboard');
			window.setTimeout(() => setCopied(false), 1500);
		} catch {
			toast.error("Couldn't copy to clipboard");
		}
	};

	return (
		<div
			className={cn(
				'group relative flex items-start gap-3 rounded-lg border bg-accent py-2.5 pr-2 pl-3.5',
				className
			)}
		>
			<pre className='flex-1 overflow-x-auto py-0.5 font-mono text-xs leading-relaxed text-muted-foreground'>
				{code}
			</pre>
			<Button
				type='button'
				variant='outline'
				size='icon-sm'
				onClick={handleCopy}
				aria-label='Copy code'
				className='sticky right-0 shrink-0'
			>
				{copied ? (
					<CheckIcon className='size-3.5 text-green-500' />
				) : (
					<CopyIcon className='size-3.5' />
				)}
			</Button>
		</div>
	);
}

/** A small monospace label used to annotate individual specimens. */
export function Tag({ children }: { children: ReactNode }) {
	return (
		<span className='rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground'>
			{children}
		</span>
	);
}

/**
 * A vertically stacked specimen with a caption underneath — handy for showing
 * a control alongside the variant/size name that produced it.
 */
export function Cell({
	label,
	children,
	className,
}: {
	label: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn('flex flex-col items-start gap-2', className)}>
			{children}
			<Tag>{label}</Tag>
		</div>
	);
}
