import { Link } from '@tanstack/react-router';

import { API } from '~api';

type OrgProjectsProps = {
	projects: API['project']['getManyByOrg'];
	orgSlug: string;
};

export const OrgProjects = ({ projects, orgSlug }: OrgProjectsProps) => {
	return (
		<div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
			{projects?.map((project) => {
				return (
					<Link
						key={project._id}
						to='/@{$org}/$project'
						params={(prev) => ({
							...prev,
							org: orgSlug,
							project: project.slug,
						})}
						// className='col-span-6 md:col-span-3'
					>
						<span className='inline-flex w-full flex-col gap-3 rounded-lg border bg-muted p-4 hocus:border-foreground/50 hocus:bg-accent/50'>
							<span className='text-xl'>{project.name}</span>
							<span className='capitalize'>Visibility: {project.visibility}</span>
						</span>
					</Link>
				);
			})}
		</div>
	);
};
