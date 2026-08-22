'use client';

import type { ApiOutputs } from '@convex/api';

import { useState } from 'react';
import { getFileFormatPolicy } from '@convex/files';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import go from 'highlight.js/lib/languages/go';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import plaintext from 'highlight.js/lib/languages/plaintext';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { FileArchive, FileCode2, FileImage, FileText, FileVideo } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';

import css from 'highlight.js/lib/languages/css';

type FileDetail = NonNullable<ApiOutputs['file']['getFileDetail']>;

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('css', css);
hljs.registerLanguage('go', go);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('plaintext', plaintext);
hljs.registerLanguage('python', python);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('shell', shell);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('yaml', yaml);

export function FilePreviewBody({ file }: { file: FileDetail }) {
	const [imageFailed, setImageFailed] = useState(false);
	const preview = getFileFormatPolicy(file.extension)?.preview ?? 'download';
	return (
		<div
			className={cn(
				'flex min-h-[62vh] items-center justify-center overflow-hidden rounded-xl border',
				preview === 'text' ? 'bg-card' : 'bg-background',
				preview === 'image' &&
					'bg-[repeating-conic-gradient(from_0deg,color-mix(in_oklab,var(--muted)_40%,var(--background))_0_25%,transparent_0_50%)] bg-[length:20px_20px]'
			)}
		>
			{preview === 'image' && !imageFailed ? (
				<img
					alt={file.name}
					className='max-h-[75vh] max-w-full object-contain'
					onError={() => setImageFailed(true)}
					src={file.deliveryUrl}
				/>
			) : preview === 'video' ? (
				<video className='max-h-[75vh] w-full bg-black' controls preload='metadata'>
					<source src={file.deliveryUrl} type={file.mimeType} />
				</video>
			) : preview === 'pdf' ? (
				<iframe className='h-[75vh] w-full' src={file.deliveryUrl} title={file.name} />
			) : preview === 'text' ? (
				<TextPreview extension={file.extension} name={file.name} text={file.previewText} />
			) : (
				<DownloadOnlyPreview category={file.category} extension={file.extension} name={file.name} />
			)}
		</div>
	);
}

function TextPreview({
	extension,
	name,
	text,
}: {
	extension: string;
	name: string;
	text: string | null;
}) {
	if (!text) {
		return (
			<div className='max-w-md px-6 py-16 text-center'>
				<FileText className='mx-auto mb-4 size-10 text-muted-foreground' />
				<h2 className='font-semibold'>Text preview is being prepared</h2>
				<p className='mt-1 text-sm text-muted-foreground'>
					Download {name} to view it immediately.
				</p>
			</div>
		);
	}
	if (extension === 'md' || extension === 'mdx') {
		return (
			<div className='markdown-prose w-full max-w-4xl self-start px-6 py-8 md:px-10'>
				<ReactMarkdown
					components={{
						a: ({ children, ...props }) => (
							<a {...props} rel='noreferrer' target='_blank'>
								{children}
							</a>
						),
						code: ({ children, className, ...props }) => {
							const value = String(children).replace(/\n$/, '');
							const language = /language-([\w-]+)/.exec(className ?? '')?.[1];
							if (!language && !value.includes('\n'))
								return (
									<code className={className} {...props}>
										{children}
									</code>
								);
							return (
								<code
									className={cn(className, 'hljs')}
									dangerouslySetInnerHTML={{ __html: highlightSource(value, language) }}
								/>
							);
						},
					}}
					remarkPlugins={[remarkGfm]}
				>
					{text}
				</ReactMarkdown>
				{text.length >= 30_000 ? <PreviewLimitNotice /> : null}
			</div>
		);
	}
	let formatted = text;
	if (extension === 'json') {
		try {
			formatted = JSON.stringify(JSON.parse(text), null, 2);
		} catch {
			formatted = text;
		}
	}
	return (
		<div className='w-full self-stretch overflow-auto p-5'>
			<pre className='min-w-max font-mono text-xs leading-5'>
				<code
					className='hljs'
					dangerouslySetInnerHTML={{
						__html: highlightSource(formatted, rawTextLanguage(extension)),
					}}
				/>
			</pre>
			{text.length >= 30_000 ? <PreviewLimitNotice /> : null}
		</div>
	);
}

function PreviewLimitNotice() {
	return (
		<p className='mt-4 rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground'>
			Preview limited to the first 30,000 characters. Download the file to view everything.
		</p>
	);
}

function DownloadOnlyPreview({
	category,
	extension,
	name,
}: {
	category: string;
	extension: string;
	name: string;
}) {
	const Icon = fileCategoryIcon(category);
	return (
		<div className='max-w-md px-6 py-16 text-center'>
			<span className='mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border bg-muted/50'>
				<Icon className='size-7 text-muted-foreground' />
			</span>
			<h2 className='font-semibold'>{name}</h2>
			<p className='mt-1 text-sm text-muted-foreground'>
				.{extension} files are download-only in this preview version.
			</p>
		</div>
	);
}

export function fileCategoryIcon(category: string) {
	if (category === 'image') return FileImage;
	if (category === 'video') return FileVideo;
	if (category === 'package') return FileArchive;
	if (category === 'design') return FileCode2;
	return FileText;
}

function highlightSource(source: string, requestedLanguage?: string) {
	const aliases: Record<string, string> = {
		html: 'xml',
		js: 'javascript',
		jsx: 'javascript',
		md: 'markdown',
		mdx: 'markdown',
		py: 'python',
		sh: 'shell',
		text: 'plaintext',
		ts: 'typescript',
		tsx: 'typescript',
		yml: 'yaml',
	};
	const language = aliases[requestedLanguage ?? ''] ?? requestedLanguage;
	return language && hljs.getLanguage(language)
		? hljs.highlight(source, { language }).value
		: hljs.highlight(source, { language: 'plaintext' }).value;
}

function rawTextLanguage(extension: string) {
	return extension === 'txt' || extension === 'csv' ? 'plaintext' : extension;
}
