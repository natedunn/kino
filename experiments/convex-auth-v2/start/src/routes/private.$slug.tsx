import { useEffect } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useMutation } from 'convex/react';

import { api } from '../../../email/convex/_generated/api';
import { announceSessionChange } from '../session-sync';

const slug = (value: string) => {
	if (value !== 'alpha' && value !== 'beta') throw new Error('Unknown proof page');
	return value;
};
export const Route = createFileRoute('/private/$slug')({
	beforeLoad: ({ context }) => {
		if (typeof window === 'undefined' && !context.initialToken) throw redirect({ to: '/' });
	},
	loader: async ({ context, params }) => {
		await context.query.ensureQueryData(convexQuery(api.proof.read, { slug: slug(params.slug) }));
	},
	pendingComponent: () => <p id='pending'>Loading private counter</p>,
	component: Private,
});
function Private() {
	useEffect(() => {
		const id = sessionStorage.getItem('proofInvitationId');
		if (id) {
			sessionStorage.removeItem('proofInvitationId');
			location.replace('/auth/accept-invitation?invitationId=' + encodeURIComponent(id));
		}
	}, []);
	const params = Route.useParams();
	const { data } = useSuspenseQuery(convexQuery(api.proof.read, { slug: slug(params.slug) }));
	const increment = useMutation(api.proof.increment);
	return (
		<main>
			<h1>Private {data.slug}</h1>
			<p id='user'>{data.userId}</p>
			<output id='counter'>{data.value}</output>
			<button onClick={() => void increment({ slug: data.slug })}>Increment</button>
			<nav>
				<Link to='/organizations'>Organizations</Link>
				<Link to='/private/$slug' params={{ slug: data.slug === 'alpha' ? 'beta' : 'alpha' }}>
					Open {data.slug === 'alpha' ? 'beta' : 'alpha'}
				</Link>
			</nav>
			<button
				onClick={async () => {
					const response = await fetch('/api/auth/signout', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: '{}',
					});
					if (!response.ok) throw new Error('Sign-out failed');
					announceSessionChange();
					location.assign('/');
				}}
			>
				Sign out
			</button>
		</main>
	);
}
