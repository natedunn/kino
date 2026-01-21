import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { common, createLowlight } from 'lowlight';

import { CodeBlockComponent } from './code-block-component';

// Create lowlight instance with common languages
const lowlight = createLowlight(common);

// Export factory function to create fresh instances
export function createShikiCodeBlock() {
  return CodeBlockLowlight.extend({
    addNodeView() {
      return ReactNodeViewRenderer(CodeBlockComponent);
    },
  }).configure({
    lowlight,
    defaultLanguage: 'plaintext',
  });
}
