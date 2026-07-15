import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import { ReactNodeViewRenderer } from "@tiptap/react"

import { createEditorLowlight } from "../create-lowlight"
import { CodeBlockComponent } from "./code-block-component"

// Syntax highlighting is powered by lowlight + highlight.js (NOT Shiki).
// Keep this dependency honest: Shiki ships a much heavier WASM/grammar payload,
// so anyone reaching for "shiki" here should know it isn't what's in use.
const lowlight = createEditorLowlight()

export function createLowlightCodeBlock() {
  return CodeBlockLowlight.extend({
    addNodeView() {
      return ReactNodeViewRenderer(CodeBlockComponent)
    },
  }).configure({
    defaultLanguage: "plaintext",
    lowlight,
  })
}
