import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, Check, FolderKanban, Minus, Sparkles, Users } from 'lucide-react';

import {
	Cell,
	CellGrid,
	MarketingPage,
	MarketingSection,
	SoonTag,
} from '@/components/marketing/marketing-page';
import { Button } from '@/components/ui/button';
import { titleMeta } from '@/lib/seo';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_marketing/pricing')({
	head: () => ({ meta: [titleMeta(['Pricing'])] }),
	component: PricingPage,
});

/* ------------------------------------------------------------------ */
/* Pricing model                                                        */
/*                                                                      */
/* One free org, five free projects, then pay per project per month.   */
/* Paid prices and most limits are not set yet. Features that do not    */
/* exist yet are flagged `soon` and hidden by SHOW_UPCOMING_FEATURES.   */
/* The estimator at the bottom is disabled until prices exist.          */
/* ------------------------------------------------------------------ */

const FREE_PROJECTS = 5;

/**
 * Rows flagged `soon: true` are hidden from the comparison table while this is
 * false. Flip it to preview the full roadmap on the page. When a feature
 * ships, delete its `soon` flag and it shows regardless of this switch.
 */
const SHOW_UPCOMING_FEATURES = false as boolean;

type TierId = 'free' | 'plus' | 'pro' | 'max';

type Tier = {
	id: TierId;
	name: string;
	/** `null` until pricing is set; renders as a placeholder. */
	price: number | null;
	blurb: string;
	highlight?: boolean;
};

const TIERS: Array<Tier> = [
	{
		id: 'free',
		name: 'Free',
		price: 0,
		blurb: 'Every project starts here. Five per organization, no time limit.',
		highlight: true,
	},
	{
		id: 'plus',
		name: 'Plus',
		price: null,
		blurb: 'For a project that has outgrown the free limits.',
	},
	{
		id: 'pro',
		name: 'Pro',
		price: null,
		blurb: 'For a project with a real audience and a team behind it.',
	},
	{
		id: 'max',
		name: 'Max',
		price: null,
		blurb: 'For a project that needs the most room and the most control.',
	},
];

function formatPrice(price: number | null) {
	return price === null ? '$X' : `$${price}`;
}

type FeatureValue = boolean | string;

type FeatureRow = {
	label: string;
	values: Record<TierId, FeatureValue>;
	/** Not built yet. Hidden unless SHOW_UPCOMING_FEATURES is on; delete the flag when it ships. */
	soon?: boolean;
};

type FeatureGroup = {
	title: string;
	rows: Array<FeatureRow>;
};

const FEATURE_GROUPS: Array<FeatureGroup> = [
	{
		title: 'Included in every project',
		rows: [
			{
				label: 'Feedback',
				values: { free: 'Unlimited', plus: 'Unlimited', pro: 'Unlimited', max: 'Unlimited' },
			},
			{
				label: 'Updates',
				values: { free: 'Unlimited', plus: 'Unlimited', pro: 'Unlimited', max: 'Unlimited' },
			},
			{
				label: 'Roadmap',
				values: { free: 'Unlimited', plus: 'Unlimited', pro: 'Unlimited', max: 'Unlimited' },
			},
			{
				label: 'Discussions',
				values: { free: 'Unlimited', plus: 'Unlimited', pro: 'Unlimited', max: 'Unlimited' },
			},
			{ label: 'Wiki', values: { free: true, plus: true, pro: true, max: true }, soon: true },
			{ label: 'Files', values: { free: true, plus: true, pro: true, max: true } },
			{
				label: 'Members',
				values: { free: 'Unlimited', plus: 'Unlimited', pro: 'Unlimited', max: 'Unlimited' },
			},
		],
	},
	{
		title: 'Limits',
		rows: [
			{
				label: 'Storage',
				values: { free: 'Standard', plus: 'Increased', pro: 'Increased', max: 'Increased' },
			},
			{
				label: 'Max file size',
				values: { free: 'Standard', plus: 'Increased', pro: 'Increased', max: 'Increased' },
			},
			{
				label: 'Wiki documents',
				values: { free: 'Standard', plus: 'Increased', pro: 'Increased', max: 'Maximum' },
				soon: true,
			},
			{
				label: 'API request allowance',
				values: { free: 'Standard', plus: 'Standard', pro: 'Higher', max: 'Highest' },
				soon: true,
			},
			{
				label: 'Chat channels',
				values: { free: false, plus: 'Limited', pro: 'Increased', max: 'Maximum' },
				soon: true,
			},
			{
				label: 'Automated surveys',
				values: { free: false, plus: false, pro: 'Limited', max: 'Increased' },
				soon: true,
			},
			{
				label: 'Forms',
				values: { free: false, plus: false, pro: 'Limited', max: 'Increased' },
				soon: true,
			},
		],
	},
	{
		title: 'Features',
		rows: [
			{
				label: 'Auto-scheduled updates',
				values: { free: false, plus: true, pro: true, max: true },
			},
			{
				label: 'Project accent colors',
				values: { free: false, plus: true, pro: true, max: true },
			},
			{
				label: 'API access',
				values: { free: 'Read', plus: 'Read+', pro: 'Read/write', max: 'Read/write' },
				soon: true,
			},
			{
				label: 'Webhooks for Kino actions',
				values: { free: false, plus: false, pro: true, max: true },
			},
			{ label: 'Chat', values: { free: false, plus: true, pro: true, max: true }, soon: true },
			{
				label: 'File tagging and sorting',
				values: { free: false, plus: false, pro: true, max: true },
				soon: true,
			},
			{
				label: 'Surveys and forms',
				values: { free: false, plus: false, pro: true, max: true },
				soon: true,
			},
			{
				label: 'Community analytics',
				values: { free: false, plus: false, pro: true, max: true },
				soon: true,
			},
			{
				label: 'Aggregated social feed',
				values: { free: false, plus: false, pro: true, max: true },
				soon: true,
			},
			{
				label: 'Ticketing system',
				values: { free: false, plus: false, pro: false, max: true },
				soon: true,
			},
			{
				label: 'Job postings with automations',
				values: { free: false, plus: false, pro: false, max: true },
				soon: true,
			},
			{
				label: 'Auto-responder on X, Bluesky, and GitHub',
				values: { free: false, plus: false, pro: false, max: true },
				soon: true,
			},
		],
	},
	{
		title: 'Support',
		rows: [
			{
				label: 'Elevated support',
				values: { free: false, plus: false, pro: true, max: true },
			},
			{
				label: 'Priority ticket support',
				values: { free: false, plus: false, pro: false, max: true },
				soon: true,
			},
		],
	},
];

const FAQ: Array<{ q: string; a: string }> = [
	{
		q: 'Will there always be a free plan?',
		a: 'Yes. Kino will always have a free tier. The specific limits may move as the product grows, but a free organization with free projects is part of how Kino works, not a promotion.',
	},
	{
		q: 'Do I pay for the organization or the project?',
		a: 'The project. Your organization is free, name it whatever you like, and it comes with five free projects. When one project needs more, you upgrade that project. The others stay free.',
	},
	{
		q: 'What happens if I downgrade a project?',
		a: 'Nothing is deleted. The project goes back to the free limits, and anything above those limits becomes read-only until you free up room or upgrade again.',
	},
	{
		q: 'Do I need a credit card to start?',
		a: 'No. Create an organization, add projects, and start collecting feedback. You are only asked to pay when you upgrade a project.',
	},
];

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

function PricingPage() {
	return (
		<MarketingPage
			title='Start free. Pay for what you need.'
			description='One free organization, five free projects, no time limit. When a project outgrows the free tier, upgrade that project and leave the rest alone.'
		>
			<MarketingSection>
				<CellGrid>
					<Cell
						icon={<Users className='size-5' />}
						title='A free organization'
						description='Name it after your company, your side project, or your cat. It is yours and it is free.'
					/>
					<Cell
						icon={<FolderKanban className='size-5' />}
						title={`${FREE_PROJECTS} free projects`}
						description='Each with feedback boards, a roadmap, and a changelog. Enough to run real products, not a demo.'
					/>
					<Cell
						icon={<Sparkles className='size-5' />}
						title='Upgrade per project'
						description='Priced per project, per month. More storage, bigger files, and premium features for the projects that need them.'
					/>
				</CellGrid>
			</MarketingSection>

			<MarketingSection
				title='Per project, per month'
				description='Pick a tier for each project. Mix and match across your organization.'
			>
				<CellGrid columns={4}>
					{TIERS.map((tier) => (
						<TierCard key={tier.id} tier={tier} />
					))}
				</CellGrid>
				<p className='mt-4 text-xs text-muted-foreground'>Paid tier prices are not set yet.</p>
			</MarketingSection>

			<MarketingSection
				title='Find the right tier for your project'
				description='Start free. Move a project up when it hits a limit you care about.'
			>
				<FeatureTable />
				<p className='mt-4 text-xs text-muted-foreground'>
					Exact numbers for storage, file size, and documents are still being set.
				</p>
			</MarketingSection>

			{/* Estimator section lives at the bottom of this file, disabled until prices exist. */}

			<MarketingSection title='Questions'>
				<dl className='grid gap-8 md:grid-cols-2'>
					{FAQ.map((item) => (
						<div key={item.q}>
							<dt className='font-semibold'>{item.q}</dt>
							<dd className='mt-2 text-sm leading-relaxed text-muted-foreground'>{item.a}</dd>
						</div>
					))}
				</dl>
			</MarketingSection>
		</MarketingPage>
	);
}

/* ------------------------------------------------------------------ */
/* Tier cards                                                           */
/* ------------------------------------------------------------------ */

function TierCard({ tier }: { tier: Tier }) {
	return (
		<div className={cn('relative flex flex-col bg-card p-8', tier.highlight && 'bg-background')}>
			{tier.highlight ? (
				<div
					aria-hidden='true'
					className='pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-foreground/30 to-transparent'
				/>
			) : null}
			<h3 className='font-semibold'>{tier.name}</h3>
			<div className='mt-4 flex items-baseline gap-1.5'>
				<span className='text-3xl font-bold tracking-tight'>{formatPrice(tier.price)}</span>
				<span className='text-sm text-muted-foreground'>/ project / month</span>
			</div>
			<p className='mt-3 text-sm leading-relaxed text-muted-foreground'>{tier.blurb}</p>
			<div className='mt-auto pt-8'>
				{tier.id === 'free' ? (
					<Button asChild className='w-full'>
						<Link to='/auth'>
							Start for free
							<ArrowRight />
						</Link>
					</Button>
				) : (
					<Button variant='outline' className='w-full' disabled>
						Coming soon
					</Button>
				)}
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* Feature table                                                        */
/* ------------------------------------------------------------------ */

function FeatureTable() {
	return (
		<div className='overflow-x-auto rounded-lg border border-border'>
			<table className='w-full min-w-2xl border-collapse text-sm'>
				<thead>
					<tr className='border-b border-border bg-muted/40'>
						<th
							scope='col'
							className='w-[40%] px-5 py-3 text-left font-medium text-muted-foreground'
						>
							Per project
						</th>
						{TIERS.map((tier) => (
							<th key={tier.id} scope='col' className='px-5 py-3 text-left'>
								<div className='font-semibold'>{tier.name}</div>
								<div className='text-xs font-normal text-muted-foreground'>
									{formatPrice(tier.price)} / mo
								</div>
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{FEATURE_GROUPS.filter((group) => visibleRows(group).length > 0).map((group) => (
						<FeatureGroupRows key={group.title} group={group} />
					))}
				</tbody>
			</table>
		</div>
	);
}

function visibleRows(group: FeatureGroup) {
	return group.rows.filter((row) => SHOW_UPCOMING_FEATURES || !row.soon);
}

function FeatureGroupRows({ group }: { group: FeatureGroup }) {
	return (
		<>
			<tr className='border-b border-border/60 bg-card'>
				<th
					scope='rowgroup'
					colSpan={TIERS.length + 1}
					className='px-5 pt-5 pb-2 text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase'
				>
					{group.title}
				</th>
			</tr>
			{visibleRows(group).map((row) => (
				<tr key={row.label} className='border-b border-border/60 bg-card last:border-b-0'>
					<th scope='row' className='px-5 py-3 text-left font-normal'>
						<span className='inline-flex items-center gap-2'>
							{row.label}
							{row.soon ? <SoonTag /> : null}
						</span>
					</th>
					{TIERS.map((tier) => (
						<td key={tier.id} className='px-5 py-3'>
							<FeatureCell value={row.values[tier.id]} />
						</td>
					))}
				</tr>
			))}
		</>
	);
}

function FeatureCell({ value }: { value: FeatureValue }) {
	if (value === true) {
		return <Check className='size-4 text-foreground' aria-label='Included' />;
	}
	if (value === false) {
		return <Minus className='size-4 text-muted-foreground/40' aria-label='Not included' />;
	}
	return <span>{value}</span>;
}

/* ------------------------------------------------------------------ */
/* Estimator (disabled until tier prices exist)                         */
/*                                                                      */
/* To re-enable: uncomment the block below, import `useState` from      */
/* 'react', `Plus` from 'lucide-react', and `ReactNode` type, then add  */
/* the section back into <PricingPage>:                                 */
/*                                                                      */
/*   <MarketingSection                                                  */
/*     title='Estimate your monthly cost'                               */
/*     description='Your free projects are always included. Add the     */
/*       projects you would upgrade.'                                   */
/*   >                                                                  */
/*     <Estimator />                                                    */
/*   </MarketingSection>                                                */
/* ------------------------------------------------------------------ */

// const PAID_TIERS = TIERS.filter((tier) => tier.id !== 'free');
//
// function Estimator() {
// 	const [counts, setCounts] = useState<Record<TierId, number>>({
// 		free: FREE_PROJECTS,
// 		plus: 1,
// 		pro: 0,
// 		max: 0,
// 	});
//
// 	const total = PAID_TIERS.reduce((sum, tier) => sum + (tier.price ?? 0) * counts[tier.id], 0);
// 	const paidProjects = PAID_TIERS.reduce((sum, tier) => sum + counts[tier.id], 0);
//
// 	const setCount = (id: TierId, next: number) =>
// 		setCounts((prev) => ({ ...prev, [id]: Math.max(0, Math.min(99, next)) }));
//
// 	return (
// 		<div className='grid gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-[minmax(0,1fr)_20rem]'>
// 			<ul className='flex flex-col divide-y divide-border/60 bg-card'>
// 				<EstimatorRow
// 					name='Free'
// 					detail={`${FREE_PROJECTS} projects included with your organization`}
// 					price={0}
// 					count={FREE_PROJECTS}
// 				/>
// 				{PAID_TIERS.map((tier) => (
// 					<EstimatorRow
// 						key={tier.id}
// 						name={tier.name}
// 						detail={`${formatPrice(tier.price)} per project per month`}
// 						price={tier.price ?? 0}
// 						count={counts[tier.id]}
// 						onChange={(next) => setCount(tier.id, next)}
// 					/>
// 				))}
// 			</ul>
// 			<div className='flex flex-col justify-between gap-6 bg-background p-8'>
// 				<div>
// 					<p className='text-sm text-muted-foreground'>Estimated monthly cost</p>
// 					<p className='mt-2 text-4xl font-bold tracking-tight'>
// 						${total}
// 						<span className='text-base font-normal text-muted-foreground'> / month</span>
// 					</p>
// 					<p className='mt-3 text-sm text-muted-foreground'>
// 						{FREE_PROJECTS} free projects
// 						{paidProjects > 0
// 							? ` and ${paidProjects} upgraded ${paidProjects === 1 ? 'project' : 'projects'}.`
// 							: '. Nothing to pay.'}
// 					</p>
// 				</div>
// 				<Button asChild>
// 					<Link to='/auth'>
// 						Start for free
// 						<ArrowRight />
// 					</Link>
// 				</Button>
// 			</div>
// 		</div>
// 	);
// }
//
// function EstimatorRow({
// 	name,
// 	detail,
// 	price,
// 	count,
// 	onChange,
// }: {
// 	name: string;
// 	detail: ReactNode;
// 	price: number;
// 	count: number;
// 	onChange?: (next: number) => void;
// }) {
// 	const subtotal = price * count;
//
// 	return (
// 		<li className='flex items-center gap-4 px-6 py-4'>
// 			<div className='min-w-0 flex-1'>
// 				<p className='font-medium'>{name}</p>
// 				<p className='text-sm text-muted-foreground'>{detail}</p>
// 			</div>
// 			{onChange ? (
// 				<div className='flex items-center gap-1'>
// 					<Button
// 						variant='outline'
// 						size='icon-sm'
// 						type='button'
// 						aria-label={`Fewer ${name} projects`}
// 						disabled={count <= 0}
// 						onClick={() => onChange(count - 1)}
// 					>
// 						<Minus />
// 					</Button>
// 					<span className='w-8 text-center text-sm font-medium tabular-nums'>{count}</span>
// 					<Button
// 						variant='outline'
// 						size='icon-sm'
// 						type='button'
// 						aria-label={`More ${name} projects`}
// 						onClick={() => onChange(count + 1)}
// 					>
// 						<Plus />
// 					</Button>
// 				</div>
// 			) : (
// 				<span className='w-[4.75rem] text-center text-sm font-medium tabular-nums'>{count}</span>
// 			)}
// 			<span className='w-16 text-right text-sm font-medium tabular-nums'>${subtotal}</span>
// 		</li>
// 	);
// }
