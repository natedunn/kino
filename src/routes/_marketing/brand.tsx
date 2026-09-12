import { createFileRoute, Link } from '@tanstack/react-router';
import { Check, X } from 'lucide-react';

import { KinoBrand, KinoName } from '@/components/kino-brand';
import { KinoMark } from '@/components/kino-mark';
import { MarketingPage, MarketingSection, SoonTag } from '@/components/marketing/marketing-page';
import { Button } from '@/components/ui/button';
import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/_marketing/brand')({
	head: () => ({ meta: [titleMeta(['Brand'])] }),
	component: BrandPage,
});

const DOS = [
	'Write the name as “Kino”, capital K, in running text.',
	'Use the ™ symbol on the first or most prominent use of the name on a page.',
	'Keep the mark in its tile with clear space at least the width of the “K”.',
	'Use the monochrome mark on photography or busy backgrounds.',
];

const DONTS = [
	'Don’t stretch, rotate, recolor, or add effects to the mark.',
	'Don’t combine the mark with your own logo to imply a partnership.',
	'Don’t use “Kino” in your product name or domain.',
	'Don’t recreate the mark from scratch or use an outdated version.',
];

function BrandPage() {
	return (
		<MarketingPage
			title={
				<>
					The <KinoName className='font-bold' /> mark and name.
				</>
			}
			description='Guidelines and assets for referring to Kino in articles, integrations, and talks. Simple rules, no lawyers required.'
		>
			<MarketingSection
				title='The mark'
				description='A square tile with the letterforms cut out. It always sits on its own background so it holds up at favicon size.'
			>
				<div className='grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2'>
					<figure className='flex flex-col items-center justify-center gap-6 bg-white p-12 text-white'>
						<div className='size-24 overflow-hidden rounded-xl border border-black/10 [--color-foreground:oklch(0.1448_0_0)]'>
							<KinoMark aria-hidden='true' className='h-full w-full' />
						</div>
						<figcaption className='text-xs font-medium tracking-wider text-neutral-500 uppercase'>
							On light
						</figcaption>
					</figure>
					<figure className='flex flex-col items-center justify-center gap-6 bg-neutral-950 p-12 text-neutral-900'>
						<div className='size-24 overflow-hidden rounded-xl border border-white/15 [--color-foreground:oklch(1_0_0)]'>
							<KinoMark aria-hidden='true' className='h-full w-full' />
						</div>
						<figcaption className='text-xs font-medium tracking-wider text-neutral-400 uppercase'>
							On dark
						</figcaption>
					</figure>
				</div>
			</MarketingSection>

			<MarketingSection
				title='The lockup'
				description='The mark paired with the name. The trademark symbol travels with the name whenever it appears as a brand.'
			>
				<div className='flex flex-col gap-px overflow-hidden rounded-lg border border-border bg-border'>
					<div className='flex flex-wrap items-center justify-around gap-8 bg-card px-8 py-12'>
						<KinoBrand size='lg' />
						<KinoBrand size='md' />
						<KinoBrand size='sm' />
					</div>
					<div className='flex flex-wrap items-center gap-x-8 gap-y-3 bg-card px-8 py-5 text-sm text-muted-foreground'>
						<span>
							Name: <KinoName className='text-foreground' />
						</span>
						<span>
							Plain text:{' '}
							<code className='rounded bg-muted px-1.5 py-0.5 text-foreground'>Kino™</code>
						</span>
						<span>
							Possessive: <KinoName className='text-foreground' trademark={false} />
							’s
						</span>
					</div>
				</div>
			</MarketingSection>

			<MarketingSection title='Color'>
				<div className='grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 md:grid-cols-4'>
					<Swatch name='Kino Blue' className='bg-primary text-primary-foreground' note='Primary' />
					<Swatch name='Ink' className='bg-neutral-950 text-white' note='Foreground · dark bg' />
					<Swatch name='Paper' className='bg-white text-neutral-900' note='Background · light' />
					<Swatch name='Graphite' className='bg-neutral-800 text-white' note='Surfaces · dark' />
				</div>
			</MarketingSection>

			<MarketingSection title='Usage'>
				<div className='grid gap-8 md:grid-cols-2'>
					<ul className='flex flex-col gap-3 text-sm'>
						{DOS.map((item) => (
							<li key={item} className='flex items-start gap-2.5'>
								<Check className='mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400' />
								<span>{item}</span>
							</li>
						))}
					</ul>
					<ul className='flex flex-col gap-3 text-sm'>
						{DONTS.map((item) => (
							<li key={item} className='flex items-start gap-2.5'>
								<X className='mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400' />
								<span>{item}</span>
							</li>
						))}
					</ul>
				</div>
			</MarketingSection>

			<MarketingSection
				title='Assets'
				description='Downloadable SVG and PNG versions of the mark and lockup, plus a press kit.'
			>
				<div className='flex flex-wrap items-center gap-3'>
					<Button variant='outline' disabled>
						Download assets
					</Button>
					<SoonTag />
				</div>
				<p className='mt-6 max-w-2xl text-sm text-muted-foreground'>
					<KinoName className='text-foreground' /> and the Kino mark are trademarks of Kino. Use of
					the name or mark outside these guidelines requires permission — reach out via the{' '}
					<Link to='/contact' className='link-text text-foreground'>
						contact page
					</Link>
					.
				</p>
			</MarketingSection>
		</MarketingPage>
	);
}

function Swatch({ name, note, className }: { name: string; note: string; className: string }) {
	return (
		<div className={`flex aspect-[4/3] flex-col justify-end p-5 ${className}`}>
			<p className='font-semibold'>{name}</p>
			<p className='text-xs opacity-70'>{note}</p>
		</div>
	);
}
