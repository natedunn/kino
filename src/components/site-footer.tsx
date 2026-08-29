import { Link } from '@tanstack/react-router';

import { m } from '@/paraglide/messages.js';

import { LanguageSelector } from './language-selector';

export function SiteFooter({ showGitHub = false }: { showGitHub?: boolean }) {
	return (
		<footer className='mt-auto w-full border-t border-border py-4 text-sm text-muted-foreground'>
			<div className='container flex flex-wrap items-center justify-between gap-4'>
				<p>© {new Date().getFullYear()} Kino</p>
				<div className='flex flex-wrap items-center justify-end gap-x-4 gap-y-2'>
					<LanguageSelector />
					<Link to='/docs/notices' className='transition-colors hocus:text-foreground'>
						{m.footer_notices()}
					</Link>
					{showGitHub ? (
						<a
							href='https://github.com'
							target='_blank'
							rel='noopener noreferrer'
							className='transition-colors hocus:text-foreground'
						>
							GitHub
						</a>
					) : null}
				</div>
			</div>
		</footer>
	);
}
