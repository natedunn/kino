import { GenericQueryCtx } from 'convex/server';
import { ConvexError } from 'convex/values';

import { DataModel, Id } from './_generated/dataModel';
import { OrgIdentifiers } from './org.lib';
import { OrgMember } from './schema/orgMember.schema';

type FindOrgMemberArgs = {
	org: OrgIdentifiers;
	profile: {
		id: Id<'profile'>;
	};
};

const _findOrgMember = async (
	ctx: GenericQueryCtx<DataModel>,
	{ org, profile }: FindOrgMemberArgs
) => {
	if (!org.id && !org.slug) {
		throw new ConvexError({
			message: 'No identifiers were passed. Provide an `id` or a `slug`',
			code: '400',
		});
	}

	let orgMember: OrgMember | null = null;

	if (org.id) {
		orgMember = await ctx.db
			.query('orgMember')
			.withIndex('by_profileId_organizationId', (q) =>
				q.eq('profileId', profile.id).eq('organizationId', org.id as Id<'project'>)
			)
			.unique();
	} else if (org.slug) {
		orgMember = await ctx.db
			.query('orgMember')
			.withIndex('by_profileId_orgSlug', (q) =>
				q.eq('profileId', profile.id).eq('orgSlug', org.slug as string)
			)
			.unique();
	}

	if (!orgMember) return null;

	return orgMember;
};

export const findOrgMember = async (ctx: GenericQueryCtx<DataModel>, args: FindOrgMemberArgs) =>
	await _findOrgMember(ctx, args);

export const getOrgMember = async (ctx: GenericQueryCtx<DataModel>, args: FindOrgMemberArgs) => {
	const orgMember = await _findOrgMember(ctx, args);

	if (!orgMember) {
		throw new ConvexError({
			message: 'Org member not found',
			code: '404',
		});
	}

	return orgMember;
};
