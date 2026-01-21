import { useMemo } from 'react';
import { toHtml } from 'hast-util-to-html';
import { common, createLowlight } from 'lowlight';

import { cn } from '@/lib/utils';

const lowlight = createLowlight(common);

type EditorContentDisplayProps = {
	content: string;
	className?: string;
};

// Decode HTML entities in code content
function decodeHtmlEntities(str: string): string {
	return str
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'")
		.replace(/&#x2F;/g, '/');
}

// Extract language from pre or code tag attributes
function extractLanguage(preTag: string, codeTag: string): string {
	// Check for data-language on pre tag
	const dataLangMatch = preTag.match(/data-language="([^"]+)"/);
	if (dataLangMatch) return dataLangMatch[1];

	// Check for language-xxx class on code tag
	const classMatch = codeTag.match(/class="[^"]*language-(\w+)/);
	if (classMatch) return classMatch[1];

	return 'plaintext';
}

// Process HTML to add syntax highlighting to code blocks
function highlightCodeBlocks(html: string): string {
	// Match <pre>...</pre> blocks (with or without code tags)
	return html.replace(/<pre([^>]*)>([\s\S]*?)<\/pre>/gi, (match, preAttrs, innerContent) => {
		try {
			// Check if there's a code tag inside
			const codeMatch = innerContent.match(/<code([^>]*)>([\s\S]*?)<\/code>/i);

			let code: string;
			let codeAttrs: string;

			if (codeMatch) {
				codeAttrs = codeMatch[1];
				code = codeMatch[2];
			} else {
				codeAttrs = '';
				code = innerContent;
			}

			// Get language
			const lang = extractLanguage(preAttrs, codeAttrs);

			// Decode HTML entities
			const decodedCode = decodeHtmlEntities(code);

			// Highlight the code
			const highlighted = lowlight.highlight(lang, decodedCode);
			const highlightedHtml = toHtml(highlighted);

			return `<pre><code class="language-${lang} hljs">${highlightedHtml}</code></pre>`;
		} catch {
			// If highlighting fails, return original
			return match;
		}
	});
}

export function EditorContentDisplay({ content, className }: EditorContentDisplayProps) {
	// Check if content looks like HTML (from new editor) or plain text (legacy)
	const isHTML = content.startsWith('<') && content.includes('</');

	// Process code blocks for syntax highlighting
	const processedContent = useMemo(() => {
		if (!isHTML) return content;
		return highlightCodeBlocks(content);
	}, [content, isHTML]);

	if (!isHTML) {
		// Legacy plain text content - preserve whitespace
		return <div className={cn('whitespace-pre-wrap', className)}>{content}</div>;
	}

	return (
		<div
			className={cn(
				'prose max-w-none pb-1 text-foreground dark:prose-invert',
				// Headings
				'prose-headings:font-semibold',
				'prose-h4:text-[1.1rem] prose-h5:text-[1rem] prose-h6:text-[0.95rem]',
				// Links - distinct from underline
				'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
				// Code - styling handled in app.css for syntax highlighting
				'prose-code:before:content-none prose-code:after:content-none',
				// Blockquotes
				'prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:pl-4 prose-blockquote:text-muted-foreground prose-blockquote:not-italic prose-blockquote:before:content-none prose-blockquote:after:content-none',
				'[&>blockquote:first-child>*:first-child]:mt-0',
				// Lists
				'prose-ol:my-1.5 prose-ul:my-1.5 prose-li:my-0 prose-li:leading-snug',
				className
			)}
			dangerouslySetInnerHTML={{ __html: processedContent }}
		/>
	);
}
