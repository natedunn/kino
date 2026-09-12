import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, Compass, Globe, Users } from 'lucide-react';

import {
	Cell,
	CellGrid,
	MarketingPage,
	MarketingSection,
} from '@/components/marketing/marketing-page';
import { Button } from '@/components/ui/button';
import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/_marketing/about')({
	head: () => ({ meta: [titleMeta(['About'])] }),
	component: AboutPage,
});

function AboutPage() {
	return (
		<MarketingPage
			title={<>Software gets better when users have a seat at the table.</>}
			description='Kino is a toolkit for collecting feedback, sharing a roadmap, and publishing updates — without turning your team into a support desk.'
		>
			<MarketingSection
				title='Why Kino exists'
				description='Most teams stitch this together from a form, a spreadsheet, and a newsletter. It works until it doesn’t.'
			>
				<div className='max-w-2xl space-y-4 text-muted-foreground'>
					<p>
						Feedback gets lost in inboxes. Roadmaps go stale in slide decks. Changelogs are written
						once and never read. Kino puts all three in one place, connected — so a request can
						become a roadmap item, ship, and be announced to the people who asked for it.
					</p>
					<p>
						It is built for small product teams, indie developers, and maintainers who want a
						public, honest relationship with the people using their work.
					</p>
				</div>
			</MarketingSection>

			<MarketingSection title='Principles'>
				<CellGrid>
					<Cell
						icon={<Globe className='size-5' />}
						title='Public by default'
						description='Your boards, roadmap, and changelog live on a public page your users can actually find. This site runs on the same product it sells.'
					/>
					<Cell
						icon={<Users className='size-5' />}
						title='Users at the table'
						description='Upvotes, comments, and status changes are first-class. Your users should never wonder what happened to their idea.'
					/>
					<Cell
						icon={<Compass className='size-5' />}
						title='Calm by design'
						description='No growth hacks, no noisy notifications. Kino should be something you check because you want to.'
					/>
				</CellGrid>
			</MarketingSection>

			<MarketingSection
				title='Built on a modern stack'
				description='Kino runs on a fast, well-documented stack, and we publish what it is made of.'
			>
				<div className='flex flex-wrap items-center gap-3'>
					<Button asChild variant='outline'>
						<Link to='/docs/stack'>
							See the tech stack
							<ArrowRight />
						</Link>
					</Button>
				</div>
			</MarketingSection>

			<MarketingSection
				title='Who makes Kino'
				description='Kino is currently built and operated by Nate Dunn as an independent project.'
			>
				<div className='max-w-2xl space-y-4 text-muted-foreground'>
					<p>
						It is under active development. Features may change, and some parts of the product
						described on this site are still being built. The{' '}
						<Link to='/docs/development' className='link-text text-foreground'>
							development notice
						</Link>{' '}
						sets expectations for using an evolving service.
					</p>
				</div>
			</MarketingSection>

			<MarketingSection className='bg-muted/30'>
				<div className='text-center'>
					<h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
						Give your users a seat at the table.
					</h2>
					<p className='mt-3 text-muted-foreground'>
						Free for small teams. Set up in under a minute.
					</p>
					<div className='mt-6'>
						<Button asChild>
							<Link to='/auth'>
								Start for free
								<ArrowRight />
							</Link>
						</Button>
					</div>
				</div>
			</MarketingSection>
		</MarketingPage>
	);
}
