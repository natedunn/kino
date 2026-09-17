import type { ReactNode } from 'react';

import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { ArrowRight, MessageSquare, Newspaper, Route as RouteIcon } from 'lucide-react';

import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { isClientDefinitelyAuthed } from '@/lib/auth/auth-snapshot';
import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/')({
	head: () => ({
		meta: [titleMeta([])],
	}),
	// Authenticated visitors go straight to the app — a real redirect, server and
	// client. This inverse gate must fail CLOSED (unlike `requireAuth`): the
	// server uses `context.isAuthenticated` (definitive from `loaderToken`), and
	// the client uses `isClientDefinitelyAuthed()` (settled-and-authed only). The
	// fail-open client signal would flash a just-loaded anonymous visitor to
	// /dashboard → /auth instead of showing the public landing page.
	beforeLoad: ({ context }) => {
		const authed =
			typeof window === 'undefined' ? context.isAuthenticated : isClientDefinitelyAuthed();
		if (authed) {
			throw redirect({ to: '/dashboard', replace: true });
		}
	},
	component: LandingPage,
});

function LandingPage() {
	return (
		<AppShell>
			{/* Hero */}
			<main className='flex-1'>
				<section className='container py-24 md:py-32'>
					<div className='max-w-2xl'>
						<h1 className='text-4xl font-bold tracking-tight md:text-5xl'>
							Ship products with your team, not around them.
						</h1>
						<p className='mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground'>
							Feedback boards, roadmaps, and changelogs — in one place. Give your users a seat at
							the table without losing focus.
						</p>
						<div className='mt-8 flex items-center gap-3'>
							<Button asChild>
								<Link to='/auth'>
									Start for free
									<ArrowRight />
								</Link>
							</Button>
						</div>
					</div>
				</section>

				{/* Feature cards */}
				<section className='border-t border-border/50'>
					<div className='container py-20 md:py-24'>
						<div className='grid gap-px rounded-lg border border-border bg-border md:grid-cols-3'>
							<FeatureCell
								icon={<MessageSquare className='size-5' />}
								title='Feedback'
								description='Collect bugs, feature requests, and ideas. Let users upvote so you know what matters.'
							/>
							<FeatureCell
								icon={<RouteIcon className='size-5' />}
								title='Roadmap'
								description="Share what you're working on. Move items through statuses as you build."
							/>
							<FeatureCell
								icon={<Newspaper className='size-5' />}
								title='Updates'
								description='Write changelogs and announcements. Keep your users informed without the noise.'
							/>
						</div>
					</div>
				</section>

				{/* CTA */}
				<section className='border-t border-border/50'>
					<div className='container py-20 text-center md:py-24'>
						<h2 className='text-2xl font-bold tracking-tight md:text-3xl'>Ready to get started?</h2>
						<p className='mt-3 text-muted-foreground'>
							Free for small teams. Set up in under a minute and start collecting feedback fast.
						</p>
						<div className='mt-6'>
							<Button asChild>
								<Link to='/auth'>
									Create your first project
									<ArrowRight />
								</Link>
							</Button>
						</div>
					</div>
				</section>
			</main>
		</AppShell>
	);
}

function FeatureCell({
	icon,
	title,
	description,
}: {
	icon: ReactNode;
	title: string;
	description: string;
}) {
	return (
		<div className='bg-card p-8 first:rounded-t-lg last:rounded-b-lg md:p-10 md:first:rounded-tl-lg md:first:rounded-tr-none md:last:rounded-br-lg md:last:rounded-bl-none [&:nth-child(1)]:md:rounded-bl-lg [&:nth-child(3)]:md:rounded-tr-lg'>
			<div className='flex items-center gap-2.5 text-foreground'>
				{icon}
				<h3 className='font-semibold'>{title}</h3>
			</div>
			<p className='mt-3 text-sm leading-relaxed text-muted-foreground'>{description}</p>
		</div>
	);
}
