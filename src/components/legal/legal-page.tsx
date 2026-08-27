import type { ReactNode } from 'react';

import { DocsPageHeader } from '@/components/docs/docs-page-header';

export const LEGAL_LAST_UPDATED = 'August 19, 2026';

export function LegalPage({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<div>
			<DocsPageHeader
				description={description}
				meta={<>Last updated {LEGAL_LAST_UPDATED}</>}
				title={title}
			/>

			<article className='prose mt-10 max-w-none prose-neutral dark:prose-invert prose-headings:scroll-mt-24 prose-headings:tracking-tight prose-a:text-primary prose-a:decoration-primary/40 prose-a:underline-offset-4 prose-li:marker:text-muted-foreground'>
				{children}
			</article>
		</div>
	);
}

export function LegalContact() {
	return (
		<>
			<p>
				Kino plans to provide a private in-product channel for questions, reports, privacy requests,
				and appeals. It should be available without signing in so that locked-out users can reach
				Kino and should provide a private way for Kino to respond.
			</p>
			<p>
				Until that channel is available, non-sensitive inquiries can be submitted through the{' '}
				<a href='https://github.com/natedunn/kino/issues'>Kino issue tracker</a>. Do not include
				passwords, access tokens, private workspace content, identity documents, vulnerability
				details, or other sensitive information in a public issue.
			</p>
			<p>
				<strong>Publication note:</strong> add the live private contact route and an appropriate
				legal mailing address before publishing this notice.
			</p>
		</>
	);
}
