import { selectOrgSchema } from '@convex/schema/org.schema';
import { zodToConvex } from 'convex-helpers/server/zod';
import { doc } from 'convex-helpers/validators';
import { ConvexError, v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { query } from './_generated/server';
import schema from './generatedSchema';
import { getOrgBySlug } from './utils';

const organization = doc(schema, 'organization');
const member = doc(schema, 'member');

export const get = query({
	args: {
		slug: organization.fields.slug,
	},
	handler: async (ctx, args) => {
		const org = await ctx.db
			.query('organization')
			.withIndex('slug', (q) => q.eq('slug', args.slug))
			.unique();

		if (!org) {
			throw new ConvexError({
				message: 'Organization not found (in component)',
				code: '404',
			});
		}

		return selectOrgSchema.parse(org);
	},
	returns: zodToConvex(selectOrgSchema),
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
			publicUserId = publicUser?.userId ?? null;
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
			org: zodToConvex(selectOrgSchema.nullable()),
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
