import type { ApiOutputs } from '@convex/api';

import { Link } from '@tanstack/react-router';
import { ArrowRight, Globe, Lock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

type OrgProjectsProps = {
	projects: ApiOutputs['project']['getManyByOrg'];
	orgSlug: string;
};

export const OrgProjects = ({ projects, orgSlug }: OrgProjectsProps) => {
	return (
		<div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
			{projects?.map((project) => {
				return (
					<Link
						key={project.id}
						to='/@{$org}/$project'
						params={(prev) => ({
							...prev,
							org: orgSlug,
							project: project.slug,
						})}
						className='group block'
					>
						<div className='relative flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-all duration-200 hocus:border-primary/40 hocus:shadow-md hocus:shadow-primary/5'>
							{/* Top accent line */}
							<div className='h-0.5 w-full bg-gradient-to-r from-primary/60 via-primary/30 to-transparent' />

							<div className='flex flex-1 flex-col gap-3 p-5'>
								<div className='flex items-start justify-between gap-2'>
									<span className='text-base leading-snug font-semibold text-foreground transition-colors duration-150 group-hocus:text-primary'>
										{project.name}
									</span>
									<Badge
										variant='outline'
										className='mt-0.5 shrink-0 gap-1 text-[11px] text-muted-foreground'
									>
										{project.visibility === 'public' ? (
											<Globe className='size-2.5' />
										) : (
											<Lock className='size-2.5' />
										)}
										<span className='capitalize'>{project.visibility}</span>
									</Badge>
								</div>

								{'description' in project && project.description ? (
									<p className='line-clamp-2 text-sm leading-relaxed text-muted-foreground'>
										{project.description as string}
									</p>
								) : (
									<p className='text-sm text-muted-foreground/50 italic'>No description</p>
								)}

								<div className='mt-auto flex items-center justify-between pt-2'>
									<span className='text-xs text-muted-foreground/60'>Updated recently</span>
									<span className='inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity duration-150 group-hocus:opacity-100'>
										View project
										<ArrowRight className='size-3' />
									</span>
								</div>
							</div>
						</div>
					</Link>
				);
			})}
		</div>
	);
};
