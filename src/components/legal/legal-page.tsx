import type { ReactNode } from 'react';

import { Link } from '@tanstack/react-router';

const LEGAL_LINKS = [
	{ label: 'Privacy', to: '/docs/privacy' },
	{ label: 'Development', to: '/docs/development' },
	{ label: 'Community', to: '/docs/community-guidelines' },
	{ label: 'Cookies', to: '/docs/cookies' },
] as const;

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
		<div className='flex min-h-svh flex-col bg-background'>
			<header className='border-b border-border/60'>
				<div className='container flex min-h-16 items-center justify-between gap-6 py-3'>
					<Link to='/' className='flex items-center gap-2.5'>
						<div className='flex size-7 items-center justify-center rounded-full bg-primary'>
							<span className='text-xs font-bold text-primary-foreground'>K</span>
						</div>
						<span className='text-sm font-semibold tracking-tight'>Kino</span>
					</Link>
					<Link
						to='/docs/notices'
						className='text-sm text-muted-foreground transition-colors hocus:text-foreground'
					>
						Notices
					</Link>
				</div>
			</header>

			<main className='container flex-1 py-12 md:py-20'>
				<div>
					<div className='border-b border-border pb-8'>
						<h1 className='text-3xl font-bold tracking-tight sm:text-4xl'>{title}</h1>
						<p className='mt-4 text-base leading-7 text-muted-foreground'>{description}</p>
						<p className='mt-3 text-sm text-muted-foreground'>Last updated {LEGAL_LAST_UPDATED}</p>
					</div>

					<article className='prose mt-8 max-w-none prose-neutral dark:prose-invert prose-headings:scroll-mt-24 prose-headings:tracking-tight prose-a:text-primary prose-a:decoration-primary/40 prose-a:underline-offset-4 prose-li:marker:text-muted-foreground'>
						{children}
					</article>
				</div>
			</main>

			<footer className='border-t border-border py-6'>
				<div className='container flex flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between'>
					<p>&copy; {new Date().getFullYear()} Kino</p>
					<nav aria-label='Legal notices'>
						<ul className='flex flex-wrap gap-x-4 gap-y-2'>
							{LEGAL_LINKS.map((item) => (
								<li key={item.to}>
									<Link to={item.to} className='transition-colors hocus:text-foreground'>
										{item.label}
									</Link>
								</li>
							))}
						</ul>
					</nav>
				</div>
			</footer>
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
