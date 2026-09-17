import type { SiteLink } from '@/lib/site-links';

import { Link } from '@tanstack/react-router';
import { MoonIcon, SunIcon } from 'lucide-react';

import { KinoBrand, KinoName } from '@/components/kino-brand';
import { KinoProjectLink } from '@/components/kino-project-link';
import { SOCIAL_ICONS } from '@/components/social-icons';
import { Button } from '@/components/ui/button';
import { FOOTER_GROUPS, SOCIAL_LINKS } from '@/lib/site-links';
import { toggleThemePreference } from '@/lib/theme';
import { cn } from '@/lib/utils';
import * as m from '@/paraglide/messages.js';

import { LanguageSelector } from './language-selector';

/* ------------------------------------------------------------------ */
/* Full (marketing) footer                                             */
/* ------------------------------------------------------------------ */

export function SiteFooter() {
	return (
		<footer className='relative mt-auto w-full overflow-hidden border-t border-border bg-muted/40'>
			{/* Accent hairline — a whisper of primary along the top edge. */}
			<div
				aria-hidden='true'
				className='pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-foreground/25 to-transparent'
			/>

			<div className='relative container'>
				<div className='grid gap-12 py-16 md:py-20 lg:grid-cols-12 lg:gap-8'>
					{/* Brand block */}
					<div className='flex flex-col gap-6 lg:col-span-4'>
						<KinoBrand size='md' to='/' />
						<p className='max-w-xs text-sm leading-relaxed text-muted-foreground'>
							{m.footer_tagline()}
						</p>
						<SocialRow />
					</div>

					{/* Link columns */}
					<nav
						aria-label={m.footer_nav_label()}
						className='grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:col-span-8'
					>
						{FOOTER_GROUPS.map((group) => (
							<div key={group.id} className='flex flex-col gap-3'>
								<h2 className='text-xs font-semibold tracking-wider text-foreground uppercase'>
									{group.title()}
								</h2>
								<ul className='flex flex-col gap-2.5 text-sm'>
									{group.links.map((link) => (
										<li key={link.label()}>
											<FooterLink link={link} />
										</li>
									))}
								</ul>
							</div>
						))}
					</nav>
				</div>

				{/* Bottom bar */}
				<div className='flex flex-col gap-5 border-t border-border/70 py-6 md:flex-row md:items-center md:justify-between'>
					<div className='flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4'>
						<DevelopmentPill />
						<p>{m.footer_copyright({ year: String(new Date().getFullYear()) })}</p>
						<p className='text-muted-foreground/80'>{m.footer_trademark()}</p>
					</div>
					<div className='flex items-center gap-2'>
						<LanguageSelector />
						<ThemeToggle />
					</div>
				</div>
			</div>

			<Watermark />
		</footer>
	);
}

/**
 * Oversized wordmark sunk into the bottom edge. Pure text with a
 * background-clipped gradient — no filters, so it's cheap to paint.
 */
function Watermark() {
	return (
		<div
			aria-hidden='true'
			className='pointer-events-none relative -mb-px h-[0.42em] overflow-hidden text-[clamp(7rem,22vw,17rem)] leading-none font-bold tracking-tighter select-none'
		>
			<div className='absolute inset-x-0 top-0 bg-linear-to-b from-foreground/[0.07] to-foreground/0 bg-clip-text text-center whitespace-nowrap text-transparent dark:from-foreground/[0.09]'>
				Kino
			</div>
		</div>
	);
}

function SocialRow() {
	return (
		<ul className='flex items-center gap-1.5' aria-label={m.footer_social_heading()}>
			{SOCIAL_LINKS.map((social) => {
				const Icon = SOCIAL_ICONS[social.id];
				const iconClass =
					'flex size-9 items-center justify-center rounded-md border border-border/80 bg-background text-muted-foreground transition-colors';

				return (
					<li key={social.id}>
						{social.href ? (
							<a
								href={social.href}
								target='_blank'
								rel='noopener noreferrer'
								aria-label={social.name}
								className={cn(
									iconClass,
									'outline-none focus-visible:ring-2 focus-visible:ring-ring/50 hocus:border-foreground/30 hocus:text-foreground'
								)}
							>
								<Icon className='size-4' aria-hidden='true' />
							</a>
						) : (
							<span
								aria-disabled='true'
								title={m.footer_social_coming_soon({ network: social.name })}
								className={cn(iconClass, 'cursor-not-allowed opacity-45')}
							>
								<Icon className='size-4' aria-hidden='true' />
								<span className='sr-only'>
									{m.footer_social_coming_soon({ network: social.name })}
								</span>
							</span>
						)}
					</li>
				);
			})}
		</ul>
	);
}

/** Honest status pill — links to the development notice. */
function DevelopmentPill() {
	return (
		<Link
			to='/docs/development'
			className='inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 hocus:border-foreground/30 hocus:text-foreground'
		>
			<span className='relative flex size-1.5'>
				<span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none' />
				<span className='relative inline-flex size-1.5 rounded-full bg-emerald-500' />
			</span>
			{m.footer_status_development()}
		</Link>
	);
}

function ThemeToggle() {
	return (
		<Button
			variant='outline'
			size='icon'
			type='button'
			onClick={toggleThemePreference}
			className='relative shrink-0'
		>
			<SunIcon className='size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90' />
			<MoonIcon className='absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0' />
			<span className='sr-only'>{m.theme_toggle()}</span>
		</Button>
	);
}

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

const footerLinkClass = 'link-text text-muted-foreground transition-colors hocus:text-foreground';

function FooterLink({ link }: { link: SiteLink }) {
	switch (link.kind) {
		case 'internal':
			return (
				<Link to={link.to} className={footerLinkClass}>
					{link.label()}
				</Link>
			);
		case 'kino':
			return (
				<KinoProjectLink page={link.page} className={footerLinkClass}>
					{link.label()}
				</KinoProjectLink>
			);
		case 'external':
			return (
				<a href={link.href} target='_blank' rel='noopener noreferrer' className={footerLinkClass}>
					{link.label()}
				</a>
			);
		case 'soon':
			return (
				<span className='text-muted-foreground/60'>
					{link.label()}
					<span className='ml-1.5 inline-block rounded-sm border border-border/80 px-1 py-px align-middle text-[10px] leading-none font-medium tracking-wide text-muted-foreground/70 uppercase'>
						{m.footer_soon()}
					</span>
				</span>
			);
	}
}

export { KinoName };
