import type { Id } from '../../../email/convex/_generated/dataModel';

import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { makeFunctionReference } from 'convex/server';

const view = makeFunctionReference<
	'query',
	{ organizationId: Id<'organizations'> },
	{
		organization: { _id: Id<'organizations'>; name: string } | null;
		role: string | null;
		permissions: { canEdit: boolean; canView: boolean };
	}
>('policy:viewOrganization');
const mine = makeFunctionReference<
	'query',
	{ paginationOpts: { numItems: number; cursor: string | null } },
	{ page: { organization: { _id: Id<'organizations'>; name: string } | null; role: string }[] }
>('organizations:listMine');
const options = (id: string) => convexQuery(view, { organizationId: id as Id<'organizations'> });
const navigation = () => convexQuery(mine, { paginationOpts: { numItems: 20, cursor: null } });
export const Route = createFileRoute('/org/$organizationId')({
	beforeLoad: ({ context }) => {
		if (typeof window === 'undefined' && !context.initialToken) throw redirect({ to: '/' });
	},
	loader: async ({ context, params }) => {
		await Promise.all([
			context.query.ensureQueryData(options(params.organizationId)),
			context.query.ensureQueryData(navigation()),
		]);
	},
	pendingComponent: () => <p>Loading organization</p>,
	component: Organization,
});
function Organization() {
	const { organizationId } = Route.useParams();
	const { data } = useSuspenseQuery(options(organizationId));
	const { data: links } = useSuspenseQuery(navigation());
	return (
		<main>
			<nav>
				<Link to='/organizations'>All organizations</Link>
				{links.page.map(
					({ organization }) =>
						organization && (
							<Link
								key={organization._id}
								to='/org/$organizationId'
								params={{ organizationId: organization._id }}
								preload='intent'
							>
								{organization.name}
							</Link>
						)
				)}
			</nav>
			{data.organization ? (
				<section data-testid='workspace' data-organization-id={data.organization._id}>
					<h1>{data.organization.name}</h1>
					<p data-testid='role'>{data.role}</p>
					<p data-testid='management'>
						{data.permissions.canEdit ? 'Management allowed' : 'Read only'}
					</p>
				</section>
			) : (
				<p data-testid='denied'>Organization unavailable</p>
			)}
		</main>
	);
}
