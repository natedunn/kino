import type { NodeViewProps } from '@tiptap/react';

import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';

const LANGUAGES = [
	{ value: 'plaintext', label: 'Plain Text' },
	{ value: 'javascript', label: 'JavaScript' },
	{ value: 'typescript', label: 'TypeScript' },
	{ value: 'jsx', label: 'JSX' },
	{ value: 'tsx', label: 'TSX' },
	{ value: 'html', label: 'HTML' },
	{ value: 'css', label: 'CSS' },
	{ value: 'json', label: 'JSON' },
	{ value: 'python', label: 'Python' },
	{ value: 'bash', label: 'Bash' },
	{ value: 'sql', label: 'SQL' },
	{ value: 'markdown', label: 'Markdown' },
	{ value: 'yaml', label: 'YAML' },
	{ value: 'go', label: 'Go' },
	{ value: 'rust', label: 'Rust' },
	{ value: 'java', label: 'Java' },
	{ value: 'c', label: 'C' },
	{ value: 'cpp', label: 'C++' },
	{ value: 'csharp', label: 'C#' },
	{ value: 'php', label: 'PHP' },
	{ value: 'ruby', label: 'Ruby' },
	{ value: 'swift', label: 'Swift' },
	{ value: 'kotlin', label: 'Kotlin' },
];

export function CodeBlockComponent({ node, updateAttributes }: NodeViewProps) {
	const language = node.attrs.language || 'plaintext';

	return (
		<NodeViewWrapper className='code-block-wrapper relative'>
			<select
				contentEditable={false}
				value={language}
				onChange={(e) => updateAttributes({ language: e.target.value })}
				className='absolute top-2 right-2 z-10 cursor-pointer rounded border border-border bg-background/80 py-1 pr-2 pl-1 text-[10px] text-muted-foreground outline-none hover:bg-background hover:text-foreground focus:border-ring'
			>
				{LANGUAGES.map((lang) => (
					<option key={lang.value} value={lang.value} className='bg-background text-foreground'>
						{lang.label}
					</option>
				))}
			</select>
			<pre>
				<NodeViewContent className='hljs' />
			</pre>
		</NodeViewWrapper>
	);
}
