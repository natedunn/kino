import type { IconProps } from '@/icons/types';
import type { ComponentType } from 'react';

import { createFileRoute } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';

import { ClickableContainer } from '@/components/clickable-container';
import { DocsPageHeader } from '@/components/docs/docs-page-header';
import {
	BaseUiLogo,
	BentoLogo,
	BetterAuthLogo,
	CloudflareLogo,
	ConvexLogo,
	KitcnLogo,
	PostHogLogo,
	ReactLogo,
	ShadcnLogo,
	TailwindLogo,
	TanStackLogo,
} from '@/components/stack/logos';
import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/docs/stack')({
	head: () => ({
		meta: [titleMeta(['Tech Stack'])],
	}),
	component: StackPage,
});

type TechItem = {
	name: string;
	blurb: string;
	href?: string;
	Logo: ComponentType<IconProps>;
};

type TechSection = {
	title: string;
	description: string;
	items: Array<TechItem>;
};

const SECTIONS: Array<TechSection> = [
	{
		title: 'Core',
		description: 'The framework, data layer, and auth that make the app run.',
		items: [
			{
				name: 'React',
				blurb: 'You know it. You love it (maybe).',
				href: 'https://react.dev',
				Logo: ReactLogo,
			},
			{
				name: 'TanStack Start',
				blurb: 'Our full-stack framework from the one and only.',
				href: 'https://tanstack.com/start',
				Logo: TanStackLogo,
			},
			{
				name: 'Convex',
				blurb: 'Reactive backend and database for our data and server functions.',
				href: 'https://convex.dev',
				Logo: ConvexLogo,
			},
			{
				name: 'Better Auth',
				blurb: 'Our auth solution, technically included with Kitcn.',
				href: 'https://better-auth.com',
				Logo: BetterAuthLogo,
			},
			{
				name: 'kitcn',
				blurb: 'Glue layer (cRPC + ORM + auth) wiring Convex to our app.',
				href: 'https://kitcn.dev/',
				Logo: KitcnLogo,
			},
		],
	},
	{
		title: 'UI',
		description: 'The components, primitives, and styling behind the interface.',
		items: [
			{
				name: 'shadcn/ui',
				blurb: 'Component patterns our UI primitives are built from.',
				href: 'https://ui.shadcn.com',
				Logo: ShadcnLogo,
			},
			{
				name: 'Base UI',
				blurb: 'Headless, accessible primitives backing our components.',
				href: 'https://base-ui.com',
				Logo: BaseUiLogo,
			},
			{
				name: 'Tailwind CSS',
				blurb: 'Utility-first styling system for the whole app.',
				href: 'https://tailwindcss.com',
				Logo: TailwindLogo,
			},
		],
	},
	{
		title: 'Infrastructure & Analytics',
		description: 'Where the app runs and how we understand usage.',
		items: [
			{
				name: 'Cloudflare',
				blurb: 'What don’t we use Cloudflare for?',
				href: 'https://cloudflare.com',
				Logo: CloudflareLogo,
			},
			{
				name: 'PostHog',
				blurb: 'Product analytics for understanding how the app is used.',
				href: 'https://posthog.com',
				Logo: PostHogLogo,
			},
			{
				name: 'Bento',
				blurb:
					'Email platform for our transactional sends — verification, password resets, and invites.',
				href: 'https://bentonow.com',
				Logo: BentoLogo,
			},
		],
	},
];

function StackPage() {
	return (
		<div>
			<DocsPageHeader
				description='The tools and technologies we use to build and run Kino — and what each one does in the project.'
				title='Tech Stack'
			/>

			<div className='mt-12 space-y-12'>
				{SECTIONS.map((section) => (
					<section key={section.title}>
						<div className='max-w-xl'>
							<h2 className='text-xl font-semibold tracking-tight'>{section.title}</h2>
							<p className='mt-2 text-sm text-muted-foreground'>{section.description}</p>
						</div>
						<div className='mt-5 grid gap-px overflow-hidden rounded-lg border border-border bg-border'>
							{section.items.map((item) => (
								<TechRow key={item.name} item={item} />
							))}
						</div>
					</section>
				))}
			</div>
		</div>
	);
}

function TechRow({ item }: { item: TechItem }) {
	const { name, blurb, href, Logo } = item;

	const content = (
		<>
			<div className='flex size-12 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground'>
				<Logo className='size-6' aria-hidden='true' />
			</div>
			<div className='min-w-0 flex-1'>
				<div className='flex items-center gap-1.5'>
					<h3 className='font-semibold'>{name}</h3>
					{href ? (
						<ArrowUpRight className='size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100' />
					) : null}
				</div>
				<p className='mt-0.5 text-sm leading-relaxed text-muted-foreground'>{blurb}</p>
			</div>
		</>
	);

	const className = 'group flex items-center gap-4 bg-card p-5 transition-colors md:p-6';

	if (!href) {
		return <div className={className}>{content}</div>;
	}

	return (
		<ClickableContainer
			href={href}
			keyboardInteractive
			aria-label={`Visit the ${name} website`}
			onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}
			className={`${className} hover:bg-accent`}
		>
			{content}
		</ClickableContainer>
	);
}
