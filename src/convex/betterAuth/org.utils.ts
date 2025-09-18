import { Infer } from 'convex/values';

import { Id } from './_generated/dataModel';
import { QueryCtx } from './_generated/server';
import { tables } from './generatedSchema';

type Org = Infer<typeof tables.organization.validator>;

export const getOrg = async (
	ctx: QueryCtx,
	args: {
		slug: Org['slug'];
	}
) => {
	return await ctx.db
		.query('organization')
		.withIndex('slug', (q) => q.eq('slug', args.slug))
		.unique();
};

export const getOrgMember = async (
	ctx: QueryCtx,
	args: {
		orgId: Id<'organization'> | undefined;
		userId: Id<'user'> | undefined;
	}
) => {
	if (!args.orgId || !args.userId) {
		return null;
	}

	const member = await ctx.db
		.query('member')
		.withIndex('userId_organizationId', (q) =>
			q.eq('userId', args.userId as string).eq('organizationId', args.orgId as string)
		)
		.unique();

	return member;
};
