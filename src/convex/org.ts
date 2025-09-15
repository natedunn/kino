import { BetterAuthError } from 'better-auth';
import { ConvexError } from 'convex/values';
import { z } from 'zod';

import { limits } from '../config/limits';
import { createOrgSchema, updateOrgSchema } from '../convex/schema/org.schema';
import { components } from './_generated/api';
import { authComponent, createAuth } from './auth';
import { zAuthedMutation, zQuery } from './utils/functions';
import { getOrgBySlug } from './utils/queries/getOrgBySlug';
import { getOrgUserData } from './utils/queries/getOrgUserData';

export const create = zAuthedMutation({
	args: createOrgSchema,
	handler: async (ctx, args) => {
		const headers = await authComponent.getHeaders(ctx);

		if (headers) {
			const orgs = await createAuth(ctx).api.listOrganizations({
				headers,
			});

			const user = await createAuth(ctx).api.getActiveMember({
				headers,
			});

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

			const org = await createAuth(ctx)
				.api.createOrganization({
					body: args,
					headers,
				})
				.catch((error: BetterAuthError) => {
					throw new ConvexError({
						message: error.message,
						code: '500',
					});
				});

			return org;
		} else {
			throw new ConvexError({
				message: 'Headers not defined',
				code: '500',
			});
		}
	},
});

export const update = zAuthedMutation({
	args: updateOrgSchema,
	handler: async (ctx, args) => {
		const headers = await authComponent.getHeaders(ctx);

		if (headers) {
			const member = await createAuth(ctx).api.getActiveMember({
				headers,
			});

			const org = await getOrgBySlug(ctx, args.slug);

			if (!org) {
				throw new ConvexError({
					message: 'Organization not found',
					code: '404',
				});
			}

			if (org._id !== member?.organizationId) {
				throw new ConvexError({
					message: 'User does not have permission',
					code: '403',
				});
			}

			createAuth(ctx).api.updateOrganization({
				headers,
				body: {
					organizationId: member?.organizationId,
					data: args,
				},
			});
		} else {
			throw new ConvexError({
				message: 'Headers not defined',
				code: '500',
			});
		}
	},
});

export const getFullOrg = zQuery({
	args: {
		orgSlug: z.string(),
	},
	handler: async (ctx, args) => {
		try {
			const org = await ctx.runQuery(components.betterAuth.lib.findOne, {
				model: 'organization',
				where: [{ field: 'slug', operator: 'eq', value: args.orgSlug }],
			});

			const isOrgAdmin = await getOrgUserData(ctx, {
				orgSlug: args.orgSlug,
			});

			const parsedOrg = z
				.object({
					_creationTime: z.number(),
					_id: z.string(),
					name: z.string(),
					slug: z.string(),
				})
				.parse(org);

			return {
				isOrgAdmin,
				org: parsedOrg,
			};
		} catch {
			return null;
		}
	},
});
