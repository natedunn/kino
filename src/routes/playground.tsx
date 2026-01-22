import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { api } from '~api';

export const Route = createFileRoute('/playground')({
	component: RouteComponent,
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(convexQuery(api.profile.findMyProfile, {}));
	},
});

function RouteComponent() {
	const { data: user } = useSuspenseQuery(convexQuery(api.profile.findMyProfile, {}));

	return (
		<div className='p-3 md:p-12'>
			<h1 className='text-2xl font-bold'>Test Data</h1>
			<div className='border p-2'>
				<pre>
					<code>{JSON.stringify(user, null, 2)}</code>
				</pre>
			</div>
		</div>
	);
}
