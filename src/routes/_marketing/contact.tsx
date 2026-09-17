import { createFileRoute, Link } from '@tanstack/react-router';
import {
	ArrowRight,
	ArrowUpRight,
	Inbox,
	MessageSquare,
	Newspaper,
	ShieldAlert,
} from 'lucide-react';

import { KinoProjectLink } from '@/components/kino-project-link';
import {
	Cell,
	CellGrid,
	MarketingPage,
	MarketingSection,
	SoonTag,
} from '@/components/marketing/marketing-page';
import { SOCIAL_ICONS } from '@/components/social-icons';
import { Button } from '@/components/ui/button';
import { titleMeta } from '@/lib/seo';
import { SOCIAL_LINKS } from '@/lib/site-links';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_marketing/contact')({
	head: () => ({ meta: [titleMeta(['Contact'])] }),
	component: ContactPage,
});

function ContactPage() {
	return (
		<MarketingPage
			title='Talk to the people building Kino.'
			description='Bug reports, ideas, questions, and requests about your data. Pick the channel that fits.'
		>
			<MarketingSection>
				<CellGrid>
					<Cell
						icon={<MessageSquare className='size-5' />}
						title='Bugs and ideas'
						description='Bug reports, feature requests, and questions go on Kino’s own feedback board. Upvote what matters and watch it move across the roadmap.'
					>
						<div className='mt-6 md:mt-auto md:pt-6'>
							<Button asChild variant='outline'>
								<KinoProjectLink page='feedback'>
									Open the feedback board
									<ArrowRight />
								</KinoProjectLink>
							</Button>
						</div>
					</Cell>
					<Cell
						icon={<Inbox className='size-5' />}
						title={
							<span className='inline-flex items-center gap-2'>
								Private inbox
								<SoonTag />
							</span>
						}
						description='A private channel for privacy requests, appeals, account problems, and anything you would not post publicly. It will work without signing in.'
					>
						<div className='mt-6 md:mt-auto md:pt-6'>
							<Button variant='outline' disabled>
								Coming soon
							</Button>
						</div>
					</Cell>
					<Cell
						icon={<ShieldAlert className='size-5' />}
						title={
							<span className='inline-flex items-center gap-2'>
								Security
								<SoonTag />
							</span>
						}
						description='Please do not post vulnerability details publicly. A private disclosure route is being set up; hold reports until it is live.'
					>
						<div className='mt-6 md:mt-auto md:pt-6'>
							<Button variant='outline' disabled>
								Coming soon
							</Button>
						</div>
					</Cell>
				</CellGrid>

				<p className='mt-6 max-w-2xl text-sm text-muted-foreground'>
					Never include passwords, access tokens, private workspace content, or identity documents
					in a public post. See the{' '}
					<Link to='/docs/privacy' className='link-text text-foreground'>
						privacy policy
					</Link>{' '}
					for how requests about your data are handled.
				</p>
			</MarketingSection>

			<MarketingSection
				title='Follow along'
				description='Release notes and announcements are published on the Kino changelog. Social profiles are on the way.'
			>
				<ul className='flex flex-wrap gap-3'>
					<li>
						<KinoProjectLink
							page='updates'
							className='inline-flex items-center gap-2 rounded-md border border-border bg-card px-3.5 py-2 text-sm text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 hocus:border-foreground/30 hocus:bg-accent'
						>
							<Newspaper className='size-4' aria-hidden='true' />
							Changelog
							<ArrowRight className='size-3.5 text-muted-foreground' />
						</KinoProjectLink>
					</li>
					{SOCIAL_LINKS.map((social) => {
						const Icon = SOCIAL_ICONS[social.id];
						const className =
							'inline-flex items-center gap-2 rounded-md border border-border bg-card px-3.5 py-2 text-sm transition-colors';

						return (
							<li key={social.id}>
								{social.href ? (
									<a
										href={social.href}
										target='_blank'
										rel='noopener noreferrer'
										className={cn(
											className,
											'text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 hocus:border-foreground/30 hocus:bg-accent'
										)}
									>
										<Icon className='size-4' aria-hidden='true' />
										{social.name}
										<ArrowUpRight className='size-3.5 text-muted-foreground' />
									</a>
								) : (
									<span
										aria-disabled='true'
										className={cn(className, 'cursor-not-allowed text-muted-foreground/70')}
									>
										<Icon className='size-4 opacity-60' aria-hidden='true' />
										{social.name}
										<SoonTag>Soon</SoonTag>
									</span>
								)}
							</li>
						);
					})}
				</ul>
			</MarketingSection>
		</MarketingPage>
	);
}
