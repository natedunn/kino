import { convexQuery } from '@convex-dev/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { Plus } from 'lucide-react';

import { api } from '~api';
import { Button } from '@/components/ui/button';
import { Label, LabelWrapper } from '@/components/ui/label';
import { authClient } from '@/lib/auth/auth-client';

import { CreateProjectForm } from './-components/create-project-form';
import { TeamSelector } from './-components/team-selector';

export const Route = createFileRoute('/_default/create/project/')({
	component: RouteComponent,
	loader: async ({ context }) => {
		const teams = await context.queryClient.ensureQueryData(convexQuery(api.user.getTeamList, {}));

		if (!teams?.teams) {
			throw redirect({
				to: '/create/team',
			});
		}
	},
});

function RouteComponent() {
	const { data: activeTeam } = authClient.useActiveOrganization();

	return (
		<div className='relative w-full'>
			<div className='absolute top-0 right-0 left-0 z-0 h-64 w-full bg-gradient-to-t from-background to-muted'></div>
			<div className='relative z-10 mx-auto max-w-2xl px-10 py-12'>
				<div className='flex items-end justify-between border-b pb-6'>
					<div>
						<LabelWrapper>
							<Label className='text-muted-foreground'>Change active team</Label>
						</LabelWrapper>
						<TeamSelector activeTeamId={activeTeam?.id} />
					</div>
					<div>
						<Button variant='secondary' asChild>
							<Link className='flex items-center' to='/create/team'>
								<Plus />
								Create a team
							</Link>
						</Button>
					</div>
				</div>
				<div className='mt-6'>
					{!!activeTeam && (
						<CreateProjectForm
							activeTeamName={activeTeam.name}
							activeTeamId={activeTeam.id}
							underLimit={true}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
