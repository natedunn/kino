import type { NodeViewProps } from '@tiptap/react';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';

const LANGUAGES = [
  { label: 'Plain Text', value: 'plaintext' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'JSX', value: 'jsx' },
  { label: 'TSX', value: 'tsx' },
  { label: 'HTML', value: 'html' },
  { label: 'CSS', value: 'css' },
  { label: 'JSON', value: 'json' },
  { label: 'Python', value: 'python' },
  { label: 'Bash', value: 'bash' },
  { label: 'SQL', value: 'sql' },
  { label: 'Markdown', value: 'markdown' },
  { label: 'YAML', value: 'yaml' },
  { label: 'Go', value: 'go' },
  { label: 'Rust', value: 'rust' },
];

export function CodeBlockComponent({ node, updateAttributes }: NodeViewProps) {
  const language = node.attrs.language || 'plaintext';

  return (
    <NodeViewWrapper className="code-block-wrapper relative">
      <select
        className="absolute top-2 right-2 z-10 cursor-pointer rounded border border-border bg-background/80 py-1 pr-2 pl-1 text-[10px] text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:border-ring"
        contentEditable={false}
        onChange={(event) => updateAttributes({ language: event.target.value })}
        value={language}
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.value} className="bg-background text-foreground" value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>
      <pre>
        <NodeViewContent className="hljs" />
      </pre>
    </NodeViewWrapper>
  );
}
