import { doc } from 'convex-helpers/validators';
import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { query } from './_generated/server';
import schema, { tables } from './generatedSchema';
import { getOrg, getOrgMember } from './org.utils';

const organization = doc(schema, 'organization');
const member = doc(schema, 'member');

export const get = query({
	args: {
		slug: tables.organization.validator.fields.slug,
	},
	handler: async (ctx, args) => {
		const org = await ctx.db
			.query('organization')
			.withIndex('slug', (q) => q.eq('slug', args.slug))
			.unique();

		return org;
	},
	returns: v.union(tables.organization.validator, v.null()),
});

export const getDetails = query({
	args: {
		slug: tables.organization.validator.fields.slug,
	},
	handler: async (ctx, args) => {
		const internalUserId = (await ctx.auth.getUserIdentity())?.subject as Id<'user'> | undefined;

		let publicUserId: string | null = null;

		if (internalUserId) {
			const publicUser = await ctx.db.get(internalUserId);
			publicUserId = publicUser?.userId ?? null;
		}

		const org = await getOrg(ctx, {
			slug: args.slug,
		});

		if (!org) {
			return {
				permissions: {
					isAdmin: false,
					isOwner: false,
					canEdit: false,
					canView: false,
					canDelete: false,
				},
				org: null,
				member: null,
				userId: publicUserId,
			};
		}

		const member = await getOrgMember(ctx, {
			orgId: org?._id,
			userId: internalUserId,
		});

		const isAdmin = member?.role === 'admin' || member?.role === 'owner';
		const isOwner = member?.role === 'owner';

		return {
			permissions: {
				isAdmin,
				isOwner,
				canEdit: isAdmin,
				canView: true,
				canDelete: isOwner,
			},
			org,
			member,
			userId: publicUserId,
		};
	},
	returns: v.union(
		v.object({
			org: v.union(organization, v.null()),
			member: v.union(member, v.null()),
			permissions: v.object({
				isAdmin: v.boolean(),
				isOwner: v.boolean(),
				canEdit: v.boolean(),
				canView: v.boolean(),
				canDelete: v.boolean(),
			}),
			userId: v.union(v.string(), v.null()),
		}),
		v.null()
	),
});
