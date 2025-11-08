import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { api } from '~api';

import { CreateTeamForm } from './-components/create-team-form';

export const Route = createFileRoute('/create/team/')({
	component: RouteComponent,
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(convexQuery(api.profile.getTeamList, {}));
	},
});

function RouteComponent() {
	const { data } = useSuspenseQuery(convexQuery(api.profile.getTeamList, {}));

	return (
		<div className='relative w-full'>
			<div className='absolute top-0 right-0 left-0 z-0 h-64 w-full bg-gradient-to-t from-background to-muted'></div>
			<div className='relative z-10 mx-auto max-w-2xl px-10 py-12'>
				{/* <Link to='/create/project'>Create a project</Link> */}
				<CreateTeamForm underLimit={!!data?.underLimit} />
			</div>
		</div>
	);
}
