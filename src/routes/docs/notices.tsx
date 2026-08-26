import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, Cookie, FileWarning, ShieldCheck, Users } from 'lucide-react';

import { LegalPage } from '@/components/legal/legal-page';
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
] as const;

function NoticesPage() {
	return (
		<LegalPage title='Notices' description='Policies and guidelines for using Kino.'>
			<div className='not-prose grid gap-3'>
				{NOTICES.map(({ description, icon: Icon, label, to }) => (
					<Link
						key={to}
						to={to}
						className='group flex items-start gap-4 rounded-lg border border-border bg-card p-5 transition-colors hocus:border-foreground/25 hocus:bg-accent/40'
					>
						<span className='flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground'>
							<Icon className='size-5' aria-hidden='true' />
						</span>
						<span className='min-w-0 flex-1'>
							<span className='font-semibold text-foreground'>{label}</span>
							<span className='mt-1 block text-sm leading-6 text-muted-foreground'>
								{description}
							</span>
						</span>
						<ArrowRight className='mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hocus:translate-x-0.5' />
					</Link>
				))}
			</div>
		</LegalPage>
	);
}
