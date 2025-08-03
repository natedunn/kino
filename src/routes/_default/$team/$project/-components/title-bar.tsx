import { ChevronRight } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

import { Route } from '../@layout';

type TitleBarProps = {
	children: React.ReactNode;
};

export const TitleBar = ({ children }: TitleBarProps) => {
	return (
		<div className='flex h-14 w-full items-center border-b border-border bg-muted/50 px-6'>
			{children}
		</div>
	);
};
