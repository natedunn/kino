import { BetterAuthError } from 'better-auth';
import { ConvexError } from 'convex/values';
import { z } from 'zod';

import { limits } from '@/config/limits';
import { createOrgSchema, updateOrgSchema } from '@/convex/schema/org.schema';
import { createAuth } from '@/lib/auth';

import { components } from '../_generated/api';
import { betterAuthComponent } from './auth';
import { procedure } from './procedure';
import { getOrgBySlug } from './utils/queries';

export const create = procedure.authed.external.mutation({
	args: createOrgSchema,
	handler: async (ctx, args) => {
		const auth = createAuth(ctx);

		const orgs = await auth.api.listOrganizations({
			headers: await betterAuthComponent.getHeaders(ctx),
		});

		const user = await betterAuthComponent.getAuthUser(ctx);

		let limit: number;
		if (user?.role === 'admin') {
			limit = limits.admin.MAX_ORGS;
		} else {
			limit = limits.free.MAX_ORGS;
		}

		if (orgs.length >= limit) {
			throw new ConvexError({
				message: 'Maximum number of teams created',
				code: '403',
			});
		}

		const org = await auth.api
			.createOrganization({
				body: args,
				headers: await betterAuthComponent.getHeaders(ctx),
			})
			.catch((error: BetterAuthError) => {
				throw new ConvexError({
					message: error.message,
					code: '500',
				});
			});

		return org;
	},
});

export const update = procedure.authed.external.mutation({
	args: updateOrgSchema,
	handler: async (ctx, args) => {
		const auth = createAuth(ctx);

		const member = await auth.api.getActiveMember({
			headers: await betterAuthComponent.getHeaders(ctx),
		});

		const org = await getOrgBySlug(ctx, args.slug);

		if (org._id !== member?.organizationId) {
			throw new ConvexError({
				message: 'User does not have permission',
				code: '403',
			});
		}

		auth.api.updateOrganization({
			headers: await betterAuthComponent.getHeaders(ctx),
			body: {
				organizationId: member?.organizationId,
				data: args,
			},
		});
	},
});

export const getFullOrg = procedure.base.external.query({
	args: {
		orgSlug: z.string(),
	},
	handler: async (ctx, args) => {
		try {
			const org = await ctx.runQuery(components.betterAuth.lib.findOne, {
				model: 'organization',
				where: [{ field: 'slug', operator: 'eq', value: args.orgSlug }],
			});

			const parsedOrg = z
				.object({
					_creationTime: z.number(),
					_id: z.string(),
					name: z.string(),
					slug: z.string(),
				})
				.parse(org);

			return parsedOrg;
		} catch {
			return null;
		}
	},
});
