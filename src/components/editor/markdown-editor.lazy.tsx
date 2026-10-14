import type { ComponentProps } from 'react';
// NOTE: type-only import — erased at build time, so it does NOT create a static
// runtime dependency on markdown-editor.tsx. The dynamic import() below is the
// only real reference, which is what lets the bundler split Tiptap + lowlight +
// highlight.js grammars into a separate chunk.
import type { MarkdownEditor, MarkdownEditorRef } from './markdown-editor';

import { forwardRef, lazy, Suspense } from 'react';

import { EditorPlaceholder } from './editor-placeholder';

const MarkdownEditorImpl = lazy(() =>
	import('./markdown-editor').then((module) => ({
		default: module.MarkdownEditor,
	}))
);

type LazyMarkdownEditorProps = Omit<ComponentProps<typeof MarkdownEditor>, 'ref'>;

/**
 * Code-split MarkdownEditor. The heavy editor bundle only loads when an editor
 * actually mounts (an interaction-gated moment), instead of shipping in the
 * route's initial JS. A static replica of the editor stands in while the chunk
 * loads, so the real editor swaps in without a visible change. The wrapper
 * forwards the imperative ref so interaction-gated consumers can still quote,
 * submit, and clear content.
 */
export const LazyMarkdownEditor = forwardRef<MarkdownEditorRef, LazyMarkdownEditorProps>(
	(props, ref) => {
		return (
			<Suspense fallback={<EditorPlaceholder {...props} />}>
				<MarkdownEditorImpl {...props} ref={ref} />
			</Suspense>
		);
	}
);

LazyMarkdownEditor.displayName = 'LazyMarkdownEditor';
