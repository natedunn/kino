import { Link } from '@tanstack/react-router';
import { FolderOpen } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';

type NoPublicProjectsProps = { orgName: string; orgSlug: string; canEdit: boolean };

export const NoPublicProjects = ({ orgName, orgSlug, canEdit }: NoPublicProjectsProps) => {
	return (
		<div className='flex w-full flex-col items-center justify-center rounded-xl border bg-muted/50 px-6 py-16 text-center'>
			<div className='relative mb-6'>
				<div className='flex h-20 w-20 items-center justify-center rounded-full bg-accent'>
					<FolderOpen className='h-10 w-10 text-muted-foreground' />
				</div>
			</div>

			<h3 className='mb-2 text-xl font-semibold text-foreground'>
				No {!canEdit && 'Public'} Projects Yet
			</h3>

			{canEdit ? (
				<div>
					<p className='mb-4 max-w-md leading-relaxed text-muted-foreground'>
						Your team hasn't created any projects yet. Get started by creating your first project.
					</p>
					<div>
						<Link
							to='/@{$org}/create-project'
							params={{
								org: orgSlug,
							}}
							className={buttonVariants({})}
						>
							Create a project
						</Link>
					</div>
				</div>
			) : (
				<p className='mb-4 max-w-md leading-relaxed text-muted-foreground'>
					{orgName ? `${orgName} hasn't` : "This team hasn't"} shared any public projects at the
					moment. Check back later to see what they're building!
				</p>
			)}

			{!canEdit && (
				<div className='flex items-center gap-2 text-sm text-muted-foreground'>
					<div className='h-2 w-2 animate-pulse rounded-full bg-muted-foreground/30' />
					<span>Projects will appear here when made public</span>
				</div>
			)}
		</div>
	);
};
