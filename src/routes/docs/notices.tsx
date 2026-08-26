import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, Blocks, Cookie, FileWarning, ShieldCheck, Users } from 'lucide-react';

import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/docs/notices')({
	head: () => ({ meta: [titleMeta(['Notices'])] }),
	component: NoticesPage,
});

const NOTICES = [
	{
		description: 'How Kino collects, uses, shares, and protects personal information.',
		icon: ShieldCheck,
		label: 'Privacy policy',
		to: '/docs/privacy',
	},
	{
		description: 'What to expect while Kino is under active development.',
		icon: FileWarning,
		label: 'Development notice',
		to: '/docs/development',
	},
	{
		description: 'The conduct expected in public and shared community spaces.',
		icon: Users,
		label: 'Community guidelines',
		to: '/docs/community-guidelines',
	},
	{
		description: 'How Kino uses cookies and similar browser storage technologies.',
		icon: Cookie,
		label: 'Cookie policy',
		to: '/docs/cookies',
	},
	{
		description: 'The tools and services used to build and run Kino.',
		icon: Blocks,
		label: 'Tech stack',
		to: '/stack',
	},
] as const;

function NoticesPage() {
	return (
		<div className='flex min-h-svh flex-col'>
			<header className='border-b border-border/50'>
				<div className='container flex items-center justify-between py-4'>
					<Link to='/' className='flex items-center gap-2.5'>
						<div className='flex size-7 items-center justify-center rounded-full bg-primary'>
							<span className='text-xs font-bold text-primary-foreground'>K</span>
						</div>
						<span className='text-sm font-semibold tracking-tight'>Kino</span>
					</Link>
				</div>
			</header>

			<main className='flex-1'>
				<section className='container py-16 md:py-24'>
					<div className='max-w-2xl'>
						<h1 className='text-4xl font-bold tracking-tight md:text-5xl'>Notices</h1>
						<p className='mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground'>
							Policies and guidelines for using Kino.
						</p>
					</div>
				</section>

				<div className='container pb-24'>
					<div className='grid gap-px overflow-hidden rounded-lg border border-border bg-border'>
						{NOTICES.map(({ description, icon: Icon, label, to }) => (
							<Link
								key={to}
								to={to}
								className='group flex items-center gap-4 bg-card p-5 transition-colors md:p-6 hocus:bg-accent'
							>
								<span className='flex size-12 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground'>
									<Icon className='size-6' aria-hidden='true' />
								</span>
								<span className='min-w-0 flex-1'>
									<span className='flex items-center gap-1.5 font-semibold text-foreground'>
										{label}
										<ArrowRight className='size-3.5 text-muted-foreground opacity-0 transition-all group-hocus:translate-x-0.5 group-hocus:opacity-100' />
									</span>
									<span className='mt-0.5 block text-sm leading-relaxed text-muted-foreground'>
										{description}
									</span>
								</span>
							</Link>
						))}
					</div>
				</div>
			</main>

			<footer className='border-t border-border py-6'>
				<div className='container flex items-center justify-between text-sm text-muted-foreground'>
					<p>&copy; {new Date().getFullYear()} Kino</p>
					<div className='flex items-center gap-4'>
						<Link to='/stack' className='transition-colors hocus:text-foreground'>
							Tech Stack
						</Link>
						<Link to='/' className='transition-colors hocus:text-foreground'>
							Home
						</Link>
					</div>
				</div>
			</footer>
		</div>
	);
}
