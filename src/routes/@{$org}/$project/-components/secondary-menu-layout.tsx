import { Link, LinkProps } from '@tanstack/react-router';
import { ClassValue } from 'clsx';
import { ChevronRight, LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type MenuItemProps = Omit<LinkProps, 'children'> & {
	className?: ClassValue;
	children?: React.ReactNode;
	icon?: LucideIcon | string;
};

export const MenuItem = ({ children, icon: Icon, className, ...rest }: MenuItemProps) => {
	return (
		<Link {...rest} className='group'>
			{({ isActive }) => {
				return (
					<span
						className={cn(
							'flex items-center justify-between gap-2 border-b p-4 transition-all duration-200 ease-in-out group-hocus:bg-muted',
							isActive && 'bg-primary/10 group-hocus:bg-primary/10!',
							className
						)}
					>
						<span className={cn('flex items-center gap-2')}>
							<span className='flex size-6 items-center justify-center bg-foreground/10 text-xs'>
								{typeof Icon === 'string' ? Icon : Icon && <Icon />}
							</span>
							<span>{children}</span>
						</span>

						<div>
							<ChevronRight
								className={cn(
									'size-5',
									isActive
										? 'text-primary'
										: 'text-muted-foreground opacity-0 transition-opacity duration-200 ease-in-out group-hocus:opacity-100'
								)}
							/>
						</div>
					</span>
				);
			}}
		</Link>
	);
};

type SecondaryMenuProps = {
	title: string;
	children: React.ReactNode;
	items: (Omit<LinkProps, 'children'> & {
		className?: ClassValue;
		children?: React.ReactNode;
		icon?: LucideIcon | string;
	})[];
};

export const SecondaryMenuLayout = ({ title, children, items }: SecondaryMenuProps) => {
	return (
		<div className='flex flex-1 bg-muted/20'>
			<div className='w-[16rem] border-r'>
				<div className='flex h-14 items-center border-b bg-muted/50 px-6 text-sm'>{title}</div>
				<div className='flex flex-col'>
					{items.map((item) => {
						return <MenuItem key={`${item.to}-${String(item.children)}` as string} {...item} />;
					})}
				</div>
			</div>
			<div className='flex flex-1 flex-col items-stretch'>{children}</div>
		</div>
	);
};
