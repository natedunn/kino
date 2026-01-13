import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';

import { EditOrgForm } from './-edit-org-form';

export const Route = createFileRoute('/@{$org}/edit/')({
	component: RouteComponent,
});

function RouteComponent() {
	const { org: slug } = Route.useParams();

	return (
		<div>
			<div className='border-b bg-muted/50'>
				<div className='container pt-12 pb-6'>
					<div className='flex items-center justify-between'>
						<div className='flex items-center gap-3'>
							<h1 className='text-2xl font-bold md:text-3xl'>Edit Organization</h1>
						</div>
					</div>
				</div>
			</div>
			<div className='container py-6'>
				<Link
					className='link-text inline-flex items-center gap-2 text-sm opacity-75 hocus:opacity-100'
					to='/@{$org}'
					params={(prev) => ({
						...prev,
						org: slug,
					})}
				>
					<ArrowLeft className='size-3' />
					Back to organization
				</Link>
				<div className='mt-6 border-t pt-6'>
					<EditOrgForm slug={slug} />
				</div>
			</div>
		</div>
	)
}
