import { createFileRoute, Link } from '@tanstack/react-router';
import { CircleCheck, CircleDot, CircleDotDashed } from 'lucide-react';

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { AssignedTo } from '../-components/assigned-to';
import Updates from '../-components/updates';
import { TitleBar } from '../../-components/title-bar';

export const Route = createFileRoute('/_default/$team/$project/feedback/$feedbackId/')({
	component: RouteComponent,
});

type Status = 'open' | 'planned' | 'closed';

const Status = ({ status }: { status: Status }) => {
	const statusClass = {
		open: 'bg-green-700/50 text-green-100',
		planned: 'bg-blue-700/50 text-blue-100',
		closed: 'bg-red-700/50 text-red-100',
	};

	return (
		<span className={cn(statusClass[status], 'inline-block px-1.5 py-0.5 text-xs capitalize')}>
			{status}
		</span>
	);
};

function RouteComponent() {
	const { team, project, feedbackId } = Route.useParams();

	const feedback = {
		id: 'blah',
		title: 'This is a feature request',
		status: 'open',
		upvotes: 0,
		assignedTo: 'natedunn',
		assignedBy: 'davinbuster',
		filedIn: 'features',
	};

	return (
		<div>
			<TitleBar>
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<Link
								className='link-text'
								to='/$team/$project/feedback'
								params={{
									team,
									project,
								}}
							>
								Feedback
							</Link>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem className='text-foreground'>#{feedbackId}</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</TitleBar>

			<header>
				<div className='border-b bg-muted/50'>
					<div className='container flex items-start gap-4 px-8 pt-12 pb-6'>
						<div className='mt-1'>
							<CircleDot size={28} className='text-primary' />
						</div>
						<div className='flex flex-col gap-2'>
							<h1 className='text-3xl'>This is a feature request</h1>
							<div className='text-sm text-muted-foreground'>
								<span>Open · 12 comments · 45 upvotes · Fresh</span>
							</div>
						</div>
					</div>
				</div>
			</header>
			<main className='p-6'>
				<div className='grid gap-4 md:grid-cols-12'>
					<div className='order-first md:order-last md:col-span-4'>
						<div className='sticky top-4 flex flex-col gap-4'>
							{/* Assigned to */}
							<AssignedTo />
							<div className='border bg-muted p-4'>
								<span className='text-xs font-bold tracking-wide uppercase opacity-25 select-none'>
									Details
								</span>
								<ul className='mt-4 flex w-full flex-col justify-center gap-3'>
									<li className='flex w-full justify-between gap-2'>
										<span className='text-xs font-semibold tracking-wide uppercase opacity-50'>
											Status:
										</span>
										<Status status={feedback.status as Status} />
									</li>
									<li className='flex w-full items-center justify-between gap-2'>
										<span className='text-xs font-semibold tracking-wide uppercase opacity-50'>
											Upvotes:
										</span>{' '}
										<span className='rounded bg-accent p-1 text-xs font-semibold tracking-wide uppercase opacity-50'>
											{feedback.upvotes}
										</span>
									</li>
									<li className='flex w-full items-center justify-between gap-2'>
										<span className='text-xs font-semibold tracking-wide uppercase opacity-50'>
											Assigned By:
										</span>{' '}
										<a className='text-sm hocus:underline' href={`/console/p/nothing/u/acme`}>
											{feedback.assignedBy}
										</a>
									</li>
									<li className='flex w-full items-center justify-between gap-2'>
										<span className='text-xs font-semibold tracking-wide uppercase opacity-50'>
											Board:
										</span>{' '}
										<span className='text-xs font-semibold tracking-wide uppercase opacity-50'>
											{feedback.filedIn}
										</span>
									</li>
								</ul>
							</div>
							<div className='flex flex-col gap-2'>
								<Button variant='outline' className='gap-2'>
									<CircleCheck size={16} />
									Mark as complete
								</Button>
								<Button variant='outline' className='gap-2'>
									<CircleDotDashed size={16} />
									Mark as in progress
								</Button>
							</div>
						</div>
					</div>
					<div className='md:col-span-8'>
						<Updates />
						<div className='mt-6 flex gap-3 rounded-lg border bg-accent/30 p-4'>
							<Textarea rows={1} placeholder='Leave a comment...' />
							<div>
								<Button className='gap-2'>Comment</Button>
							</div>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
