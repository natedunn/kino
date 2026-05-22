import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { common, createLowlight } from 'lowlight';

import { CodeBlockComponent } from './code-block-component';

const lowlight = createLowlight(common);

export function createShikiCodeBlock() {
  return CodeBlockLowlight.extend({
    addNodeView() {
      return ReactNodeViewRenderer(CodeBlockComponent);
    },
  }).configure({
    defaultLanguage: 'plaintext',
    lowlight,
  });
}
