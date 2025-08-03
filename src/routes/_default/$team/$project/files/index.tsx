import { createFileRoute } from '@tanstack/react-router';

import { Breadcrumb, BreadcrumbItem, BreadcrumbList } from '@/components/ui/breadcrumb';

import { TitleBar } from '../-components/title-bar';

export const Route = createFileRoute('/_default/$team/$project/files/')({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div>
			<TitleBar>
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem className='text-foreground'>Files</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</TitleBar>
		</div>
	);
}
