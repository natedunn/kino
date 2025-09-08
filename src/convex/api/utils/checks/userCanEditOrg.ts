import { GenericQueryCtx } from 'convex/server';
import { ConvexError } from 'convex/values';

import { DataModel } from '@/convex/_generated/dataModel';
import { createAuth } from '@/lib/auth';

import { betterAuthComponent } from '../../auth';

export const checkUserCanEditOrg = async (
	ctx: GenericQueryCtx<DataModel>,
	{
		orgSlug,
	}: {
		orgSlug: string;
	}
) => {
	const auth = createAuth(ctx);

	const memberOrgs = await auth.api
		.listOrganizations({
			headers: await betterAuthComponent.getHeaders(ctx),
		})
		.catch(() => null);

	if (!memberOrgs) {
		throw new ConvexError({
			message: 'User is not associated with any orgs',
			code: '403',
		});
	}

	if (!memberOrgs.find((org) => org.slug === orgSlug)) {
		throw new ConvexError({
			message: 'User does not have permission',
			code: '403',
		});
	}
};
