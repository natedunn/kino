import { cn } from '@/lib/utils';

// Faint diagonal hatch used purely as a visual "backend / editor-only" marker.
// `--editing-stripe` sets the stripe colour; light gray in both themes.
const STRIPES =
	'repeating-linear-gradient(-45deg, var(--editing-stripe) 0, var(--editing-stripe) 1px, transparent 1px, transparent 6px)';

/**
 * Thin decorative context band shown directly under the top-level nav on
 * editor-only ("backend") pages. It carries no text or role data — it's just a
 * quiet diagonal-hatch signifier that you're in an editing surface. Visibility
 * is decided by the call site (which already knows whether the viewer can edit).
 */
export function EditingBar({ className }: { className?: string }) {
	return (
		<div
			aria-hidden='true'
			className={cn(
				'h-10 border-b border-border/60 bg-muted/30 [--editing-stripe:color-mix(in_oklch,var(--foreground)_8%,transparent)]',
				className
			)}
			style={{ backgroundImage: STRIPES }}
		/>
	);
}
