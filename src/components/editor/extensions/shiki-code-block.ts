import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { ReactNodeViewRenderer } from '@tiptap/react';

import { createEditorLowlight } from '../create-lowlight';
import { CodeBlockComponent } from './code-block-component';

const lowlight = createEditorLowlight();

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
