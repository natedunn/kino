import { createFileRoute, Link } from '@tanstack/react-router';
import { CirclePlus } from 'lucide-react';

import { Breadcrumb, BreadcrumbItem, BreadcrumbList } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';

import { TitleBar } from '../-components/title-bar';
import { FeedbackCard } from './-components/feedback-card';

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
			<header>
				<div className='m-4 w-full rounded-xl border bg-muted/50'>
					<div className='container flex items-start gap-4 px-8 pt-12 pb-6'>
						<h1 className='text-3xl font-bold'>Feedback</h1>
					</div>
				</div>
			</header>
			<main className='grid grid-cols-12 gap-4 p-8'>
				<div className='col-span-3 flex flex-col gap-4'>
					<div>
						<Button>
							<CirclePlus size={16} /> Add feedback
						</Button>
					</div>
					<div>
						<span className='text-lg font-bold'>Boards</span>
						<ul>
							<li>
								<a href='#' className='link-text'>
									All
								</a>
							</li>
							<li>
								<a href='#' className='link-text'>
									Bugs
								</a>
							</li>
							<li>
								<a href='#' className='link-text'>
									Features
								</a>
							</li>
							<li>
								<a href='#' className='link-text'>
									Private
								</a>
							</li>
						</ul>
					</div>
				</div>
				<div className='col-span-9 flex flex-col gap-4'>
					<FeedbackCard />
					<FeedbackCard />
					<FeedbackCard />
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
				</div>
			</main>
		</div>
	);
}
