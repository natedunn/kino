import { Suspense, lazy } from 'react';
import type { ComponentProps } from 'react';
// NOTE: type-only import — erased at build time, so it does NOT create a static
// runtime dependency on markdown-editor.tsx. The dynamic import() below is the
// only real reference, which is what lets the bundler split Tiptap + lowlight +
// highlight.js grammars into a separate chunk.
import type { MarkdownEditor } from './markdown-editor';


const MarkdownEditorImpl = lazy(() =>
	import('./markdown-editor').then((module) => ({
		default: module.MarkdownEditor,
	}))
);

type LazyMarkdownEditorProps = Omit<ComponentProps<typeof MarkdownEditor>, 'ref'>;

/**
 * Code-split MarkdownEditor. The heavy editor bundle only loads when an editor
 * actually mounts (an interaction-gated moment), instead of shipping in the
 * route's initial JS. A sized skeleton reserves the space so there's no layout
 * shift while the chunk loads. For consumers that need the imperative ref
 * (e.g. comment-thread), import MarkdownEditor directly instead.
 */
export function LazyMarkdownEditor(props: LazyMarkdownEditorProps) {
	return (
		<Suspense fallback={<EditorSkeleton minHeight={props.minHeight} />}>
			<MarkdownEditorImpl {...props} />
		</Suspense>
	);
}

function EditorSkeleton({ minHeight = '100px' }: { minHeight?: string }) {
	return (
		<div aria-hidden className='overflow-hidden rounded-md'>
			<div className='flex h-[34px] items-center gap-1 border-b bg-muted/30 px-2'>
				<div className='size-5 animate-pulse rounded bg-muted' />
				<div className='size-5 animate-pulse rounded bg-muted' />
				<div className='size-5 animate-pulse rounded bg-muted' />
			</div>
			<div className='animate-pulse bg-muted/10' style={{ minHeight }} />
		</div>
	);
}
