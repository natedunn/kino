import { createFileRoute } from '@tanstack/react-router';

import { BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

import { TitleBar } from '../../-components/title-bar';

export const Route = createFileRoute('/_default/$org/$project/chat/$chatId/')({
	component: RouteComponent,
});

function RouteComponent() {
	const { chatId } = Route.useParams();
	return (
		<div>
			<TitleBar>
				<BreadcrumbList>
					<BreadcrumbItem>Chat</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem className='text-foreground'>{chatId}</BreadcrumbItem>
				</BreadcrumbList>
			</TitleBar>
		</div>
	)
}
