import type { Id } from '../../../email/convex/_generated/dataModel';

import { useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { makeFunctionReference } from 'convex/server';

const list = makeFunctionReference<
	'query',
	{ paginationOpts: { numItems: number; cursor: string | null } },
	{ page: { organization: { _id: Id<'organizations'>; name: string } | null; role: string }[] }
>('organizations:listMine');
const options = () => convexQuery(list, { paginationOpts: { numItems: 20, cursor: null } });
export const Route = createFileRoute('/organizations')({
	beforeLoad: ({ context }) => {
		if (typeof window === 'undefined' && !context.initialToken) throw redirect({ to: '/' });
	},
	loader: ({ context }) => context.query.ensureQueryData(options()),
	component: Organizations,
});
function Organizations() {
	const { data } = useSuspenseQuery(options());
	const create = useMutation(
		makeFunctionReference<'mutation', { name: string; slug: string }, Id<'organizations'>>(
			'organizations:create'
		)
	);
	const invite = useMutation(
		makeFunctionReference<
			'mutation',
			{ organizationId: Id<'organizations'>; email: string; role: 'admin'; projectIds: [] },
			Id<'invitations'>
		>('invitations:create')
	);
	const [message, setMessage] = useState('');
	const [busy, setBusy] = useState(false);
	return (
		<main>
			<h1>Organizations</h1>
			<button
				disabled={busy}
				onClick={async () => {
					setBusy(true);
					try {
						await create({ name: 'Invitation proof', slug: 'proof-' + crypto.randomUUID() });
					} catch {
						setMessage('Could not create organization');
					} finally {
						setBusy(false);
					}
				}}
			>
				Create proof organization
			</button>
			<ul>
				{data.page.map(
					({ organization, role }) =>
						organization && (
							<li key={organization._id}>
								<Link to='/org/$organizationId' params={{ organizationId: organization._id }}>
									{organization.name}
								</Link>{' '}
								— {role}
								{role !== 'moderator' && (
									<button
										disabled={busy}
										onClick={async () => {
											setBusy(true);
											try {
												await invite({
													organizationId: organization._id,
													email: 'hello@natedunn.net',
													role: 'admin',
													projectIds: [],
												});
												setMessage('Invitation created; email delivery scheduled');
											} catch {
												setMessage(
													'Invitation could not be created; check for an existing pending invitation'
												);
											} finally {
												setBusy(false);
											}
										}}
									>
										Invite hello@natedunn.net
									</button>
								)}
							</li>
						)
				)}
			</ul>
			<p role='status'>{message}</p>
		</main>
	);
}
