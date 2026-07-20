import { createEditorLowlight } from './create-lowlight';
import { formatInlineCode } from './format-inline-code';

const lowlight = createEditorLowlight();

const CODE_BLOCK_REGEX = /<pre([^>]*)>\s*<code([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi;
const CLASS_ATTRIBUTE_REGEX = /\bclass=(["'])(.*?)\1/i;
const LANGUAGE_CLASS_PREFIX = 'language-';

type HighlightNode = {
	children?: Array<HighlightNode>;
	properties?: {
		className?: Array<string>;
	};
	tagName?: string;
	value?: string;
};

function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function decodeHtmlEntities(value: string) {
	return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (entity, token) => {
		if (token[0] === '#') {
			const isHex = token[1]?.toLowerCase() === 'x';
			const codePoint = Number.parseInt(token.slice(isHex ? 2 : 1), isHex ? 16 : 10);

			if (Number.isNaN(codePoint)) {
				return entity;
			}

			return String.fromCodePoint(codePoint);
		}

		switch (token) {
			case 'amp':
				return '&';
			case 'apos':
			case 'nbsp':
				return token === 'nbsp' ? ' ' : "'";
			case 'gt':
				return '>';
			case 'lt':
				return '<';
			case 'quot':
				return '"';
			default:
				return entity;
		}
	});
}

function getClassNames(attributes: string) {
	const classValue = attributes.match(CLASS_ATTRIBUTE_REGEX)?.[2];

	if (!classValue) {
		return [];
	}

	return classValue.split(/\s+/).filter(Boolean);
}

function mergeClassNames(attributes: string, classNames: Array<string>) {
	const mergedClassNames = Array.from(new Set([...getClassNames(attributes), ...classNames]));

	if (mergedClassNames.length === 0) {
		return attributes;
	}

	const nextClassAttribute = `class="${mergedClassNames.join(' ')}"`;

	if (CLASS_ATTRIBUTE_REGEX.test(attributes)) {
		return attributes.replace(CLASS_ATTRIBUTE_REGEX, nextClassAttribute);
	}

	return `${attributes} ${nextClassAttribute}`;
}

function getLanguage(attributes: string) {
	return (
		getClassNames(attributes)
			.find((className) => className.startsWith(LANGUAGE_CLASS_PREFIX))
			?.slice(LANGUAGE_CLASS_PREFIX.length) ?? null
	);
}

function serializeHighlightedNodes(nodes: Array<HighlightNode>): string {
	return nodes
		.map((node) => {
			if (typeof node.value === 'string') {
				return escapeHtml(node.value);
			}

			if (!node.tagName) {
				return serializeHighlightedNodes(node.children ?? []);
			}

			const classNames = Array.isArray(node.properties?.className)
				? node.properties.className.filter(
						(className): className is string => typeof className === 'string'
					)
				: [];

			const attributes = classNames.length ? ` class="${escapeHtml(classNames.join(' '))}"` : '';

			return `<${node.tagName}${attributes}>${serializeHighlightedNodes(
				node.children ?? []
			)}</${node.tagName}>`;
		})
		.join('');
}

export function formatContentForDisplay(html: string) {
	return formatInlineCode(html).replace(
		CODE_BLOCK_REGEX,
		(_match, preAttributes = '', codeAttributes = '', encodedCode = '') => {
			const language = getLanguage(codeAttributes);
			const code = decodeHtmlEntities(encodedCode).replace(/\r\n?/g, '\n');
			const result =
				language && lowlight.listLanguages().includes(language)
					? lowlight.highlight(language, code)
					: lowlight.highlightAuto(code);
			const highlightedNodes = Array.isArray(result.children)
				? (result.children as Array<HighlightNode>)
				: [];

			const highlightedCode = serializeHighlightedNodes(highlightedNodes);

			return `<pre${preAttributes}><code${mergeClassNames(codeAttributes, [
				'hljs',
			])}>${highlightedCode || escapeHtml(code)}</code></pre>`;
		}
	);
}
