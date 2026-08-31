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
	BlobatarLogo,
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
import * as m from '@/paraglide/messages.js';

export const Route = createFileRoute('/docs/stack')({
	head: () => ({
		meta: [titleMeta([m.stack_meta()])],
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
		title: m.stack_section_core_title(),
		description: m.stack_section_core_description(),
		items: [
			{
				name: 'React',
				blurb: m.stack_item_react_blurb(),
				href: 'https://react.dev',
				Logo: ReactLogo,
			},
			{
				name: 'TanStack Start',
				blurb: m.stack_item_tanstack_start_blurb(),
				href: 'https://tanstack.com/start',
				Logo: TanStackLogo,
			},
			{
				name: 'Convex',
				blurb: m.stack_item_convex_blurb(),
				href: 'https://convex.dev',
				Logo: ConvexLogo,
			},
			{
				name: 'Better Auth',
				blurb: m.stack_item_better_auth_blurb(),
				href: 'https://better-auth.com',
				Logo: BetterAuthLogo,
			},
			{
				name: 'kitcn',
				blurb: m.stack_item_kitcn_blurb(),
				href: 'https://kitcn.dev/',
				Logo: KitcnLogo,
			},
		],
	},
	{
		title: m.stack_section_ui_title(),
		description: m.stack_section_ui_description(),
		items: [
			{
				name: 'shadcn/ui',
				blurb: m.stack_item_shadcn_blurb(),
				href: 'https://ui.shadcn.com',
				Logo: ShadcnLogo,
			},
			{
				name: 'Base UI',
				blurb: m.stack_item_base_ui_blurb(),
				href: 'https://base-ui.com',
				Logo: BaseUiLogo,
			},
			{
				name: 'Tailwind CSS',
				blurb: m.stack_item_tailwind_blurb(),
				href: 'https://tailwindcss.com',
				Logo: TailwindLogo,
			},
			{
				name: 'Blobatar',
				blurb: m.stack_item_blobatar_blurb(),
				href: 'https://blobatar.dev',
				Logo: BlobatarLogo,
			},
		],
	},
	{
		title: m.stack_section_infra_title(),
		description: m.stack_section_infra_description(),
		items: [
			{
				name: 'Cloudflare',
				blurb: m.stack_item_cloudflare_blurb(),
				href: 'https://cloudflare.com',
				Logo: CloudflareLogo,
			},
			{
				name: 'PostHog',
				blurb: m.stack_item_posthog_blurb(),
				href: 'https://posthog.com',
				Logo: PostHogLogo,
			},
			{
				name: 'Bento',
				blurb: m.stack_item_bento_blurb(),
				href: 'https://bentonow.com',
				Logo: BentoLogo,
			},
		],
	},
];

function StackPage() {
	return (
		<div>
			<DocsPageHeader description={m.stack_page_description()} title={m.stack_page_title()} />

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
