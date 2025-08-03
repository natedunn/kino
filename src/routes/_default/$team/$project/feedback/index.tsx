import { createFileRoute, Link } from '@tanstack/react-router';

import { Breadcrumb, BreadcrumbItem, BreadcrumbList } from '@/components/ui/breadcrumb';

import { TitleBar } from '../-components/title-bar';

export const Route = createFileRoute('/_default/$team/$project/feedback/')({
	component: RouteComponent,
});

function RouteComponent() {
	const { team, project } = Route.useParams();

	return (
		<div>
			<TitleBar>
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem className='text-foreground'>Feedback</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</TitleBar>
			<main className='p-8'>
				<Link
					to='/$team/$project/feedback/$feedbackId'
					params={{
						team,
						project,
						feedbackId: '123',
					}}
				>
					Test feedback
				</Link>
			</main>
		</div>
	);
}
