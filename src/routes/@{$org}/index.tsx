import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowUpRight, CircleCheck, FolderOpen, Settings, User } from 'lucide-react';

import { api } from '~api';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

import { NoPublicProjects } from './-components/no-public-projects';
import { OrgProjects } from './-components/org-projects';

export const Route = createFileRoute('/@{$org}/')({
	component: RouteComponent,
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(
			convexQuery(api.project.getManyByOrg, {
				orgSlug: params.org,
			})
		);
	},
});

function RouteComponent() {
	const { org: orgSlug } = Route.useParams();

	const { data: projects } = useSuspenseQuery(
		convexQuery(api.project.getManyByOrg, {
			orgSlug,
		})
	);

	const { data: orgDetails } = useSuspenseQuery(convexQuery(api.org.getDetails, { slug: orgSlug }));

	if (!orgDetails.org) return null;

	return (
		<div>
			<div className='border-b bg-muted/50'>
				<div className='container pt-12 pb-6'>
					<div className='flex items-center justify-between'>
						<div className='flex items-center gap-3'>
							<div>
								<Avatar className='size-10 border md:size-12'>
									<AvatarFallback className='text-lg font-bold'>
										{orgDetails.org.name[0].toUpperCase()}
									</AvatarFallback>
								</Avatar>
							</div>
							<h1 className='text-2xl font-bold md:text-3xl'>{orgDetails.org.name}</h1>
						</div>
						<div>
							<Button variant='outline'>
								<Settings />
								Edit
							</Button>
						</div>
					</div>
				</div>
			</div>
			<div className='container'>
				<div className='mt-6 flex items-center gap-4'>
					{!projects ? (
						<NoPublicProjects
							orgSlug={orgSlug}
							orgName={orgDetails.org.name}
							canEdit={orgDetails.permissions.canEdit}
						/>
					) : (
						<div className='w-full'>
							<div className='flex flex-col justify-stretch gap-6 md:flex-row'>
								<div className='inline-flex flex-auto flex-col gap-2 rounded-lg border bg-muted p-6'>
									<div className='flex items-center gap-2'>
										<span>
											<User className='size-7' />
										</span>
										<span className='text-gradient-primary text-3xl font-bold'>7</span>
									</div>
									<span className='text-muted-foreground'>members</span>
								</div>
								<div className='inline-flex flex-auto flex-col gap-2 rounded-lg border bg-muted p-6'>
									<div className='flex items-center gap-2'>
										<span>
											<CircleCheck className='size-7' />
										</span>
										<span className='text-gradient-primary text-3xl font-bold'>126</span>
									</div>
									<span className='text-muted-foreground'>closed items this month</span>
								</div>
								<div className='inline-flex flex-auto flex-col gap-2 rounded-lg border bg-muted p-6'>
									<div className='flex items-center gap-2'>
										<span>
											<FolderOpen className='size-7' />
										</span>
										<span className='text-gradient-primary text-3xl font-bold'>12</span>
									</div>
									<span className='text-muted-foreground'>active projects</span>
								</div>
								<div className='inline-flex flex-auto flex-col gap-2 rounded-lg border bg-muted p-6'>
									<div className='flex items-center gap-2'>
										<span>
											<ArrowUpRight className='size-7' />
										</span>
									</div>
									<span>see all stats</span>
								</div>
							</div>
							<div className='mt-12 grid w-full grid-cols-1 gap-12 md:grid-cols-12'>
								<div className='col-span-1 md:col-span-8'>
									<div className='flex items-center justify-between'>
										<h3 className='text-2xl font-bold'>Projects</h3>
										{orgDetails.permissions.canEdit && (
											<div>
												<Link
													to='/@{$org}/create-project'
													params={{
														org: orgSlug,
													}}
													className='link-text'
												>
													Create a new project
												</Link>
											</div>
										)}
									</div>
									<div className='mt-5'>
										<OrgProjects orgSlug={orgSlug} projects={projects} />
									</div>
								</div>
								<div className='col-span-1 md:col-span-4'>
									<h3 className='text-2xl font-bold'>Members</h3>
									<div className='mt-5'>Members will go here</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
