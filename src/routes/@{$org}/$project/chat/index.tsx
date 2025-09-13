import { createFileRoute } from '@tanstack/react-router';

import { BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

import { TitleBar } from '../-components/title-bar';

export const Route = createFileRoute('/@{$org}/$project/chat/')({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div>
			<TitleBar>
				<BreadcrumbList>
					<BreadcrumbItem>Chat</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem className='text-foreground'>General</BreadcrumbItem>
				</BreadcrumbList>
			</TitleBar>
		</div>
	)
}
