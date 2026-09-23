import { ConvexError, v } from 'convex/values';

import { query } from './_generated/server';
import { resolveOrganizationAccess } from './access';
import { MAX_ORGANIZATION_MEMBERS } from './organizations';

// A summary is safe for every viewer of the organization; the member roster
// remains restricted to managers.
export const get = query({
	args: { organizationId: v.id('organizations') },
	returns: v.union(v.null(), v.object({ memberCount: v.number() })),
	handler: async (ctx, { organizationId }) => {
		const access = await resolveOrganizationAccess(ctx, organizationId);
		if (!access.organization) return null;
		const memberships = await ctx.db
			.query('memberships')
			.withIndex('by_organizationId_and_role', (q) => q.eq('organizationId', organizationId))
			.take(MAX_ORGANIZATION_MEMBERS + 1);
		if (memberships.length > MAX_ORGANIZATION_MEMBERS)
			throw new ConvexError('MEMBERSHIP_LIMIT_REACHED');
		return { memberCount: memberships.length };
	},
});
