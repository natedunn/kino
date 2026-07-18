import { Check, ChevronsUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type SelectorOrg = {
	logo?: string | null;
	name: string;
	role: 'owner' | 'admin' | 'editor';
	slug: string;
};

function OrgAvatar({ org, className }: { org: SelectorOrg; className?: string }) {
	return (
		<span
			className={cn(
				'flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-foreground text-[11px] font-bold text-background',
				className
			)}
		>
			{org.logo ? (
				<img alt='' className='h-full w-full object-cover' src={org.logo} />
			) : (
				org.name[0].toUpperCase()
			)}
		</span>
	);
}

/**
 * Persistent org switcher rendered above the settings sidebar nav. Lists only
 * orgs the user can edit and reports the picked slug back to the shell.
 */
export function OrgSettingsSelector({
	activeSlug,
	onSelect,
	orgs,
}: {
	activeSlug: string | null;
	onSelect: (slug: string) => void;
	orgs: Array<SelectorOrg>;
}) {
	const active = orgs.find((org) => org.slug === activeSlug) ?? null;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant='outline' size='lg' className='w-full justify-between'>
					<span className='inline-flex min-w-0 items-center gap-2'>
						{active ? (
							<>
								<OrgAvatar org={active} />
								<span className='truncate'>{active.name}</span>
							</>
						) : (
							<span className='truncate text-muted-foreground'>Select organization</span>
						)}
					</span>
					<ChevronsUpDown className='size-4 shrink-0 text-muted-foreground' />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='start' className='w-(--anchor-width)'>
				<DropdownMenuLabel className='text-xs text-muted-foreground'>
					Organizations you can edit
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{orgs.map((org) => {
					const isActive = org.slug === activeSlug;
					return (
						<DropdownMenuItem
							key={org.slug}
							onClick={() => onSelect(org.slug)}
							className='flex items-center gap-2'
						>
							<OrgAvatar org={org} />
							<span className='min-w-0 flex-1 truncate'>{org.name}</span>
							<span className='text-[11px] text-muted-foreground capitalize'>{org.role}</span>
							<Check className={cn('size-4 shrink-0', isActive ? 'opacity-100' : 'opacity-0')} />
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
