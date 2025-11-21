import { doc } from 'convex-helpers/validators';
import { ConvexError, v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { query } from './_generated/server';
import schema from './generatedSchema';
import { getOrgBySlug } from './utils';

const organization = doc(schema, 'organization');
const member = doc(schema, 'member');

type Organization = typeof organization.type;

export const findByIdOrSlug = query({
	args: {
		id: v.optional(v.string()),
		slug: v.optional(organization.fields.slug),
	},
	handler: async (ctx, args) => {
		if (!args.id && !args.slug) {
			throw new ConvexError({
				message: 'No identifiers were passed. Provide an `id` or a `slug`',
				code: '400',
			});
		}

		let org: Organization | null = null;

		if (args.id) {
			org = await ctx.db.get(args.id as Id<'organization'>);
		} else if (args.slug) {
			org = await ctx.db
				.query('organization')
				.withIndex('slug', (q) => q.eq('slug', args.slug!))
				.unique();
		}

		if (!org) return null;

		return org;
	},
	returns: v.union(organization, v.null()),
});

export const getDetails = query({
	args: {
		slug: v.string(),
	},
	handler: async (ctx, args) => {
		const internalUserId = (await ctx.auth.getUserIdentity())?.subject as Id<'user'> | undefined;

		let publicUserId: string | null = null;

		if (internalUserId) {
			const publicUser = await ctx.db.get(internalUserId);
			publicUserId = publicUser?.profileId ?? null;
		}

		const createResponse = (
			org: any = null,
			member: any = null,
			permissions = {
				isAdmin: false,
				isOwner: false,
				canEdit: false,
				canView: false,
				canDelete: false,
			}
		) => ({
			permissions,
			org,
			member,
			userId: publicUserId,
		});

		const org = await getOrgBySlug(ctx, args.slug);

		if (!org) {
			return createResponse();
		}

		const member = await ctx.db
			.query('member')
			.withIndex('userId_organizationId', (q) =>
				q.eq('userId', internalUserId as string).eq('organizationId', org._id as string)
			)
			.unique();

		const isAdmin = member?.role === 'admin' || member?.role === 'owner';
		const isOwner = member?.role === 'owner';

		return createResponse(org, member, {
			isAdmin,
			isOwner,
			canEdit: isAdmin,
			canView: true,
			canDelete: isOwner,
		});
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
