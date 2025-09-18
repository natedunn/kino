import { BetterAuthError } from 'better-auth';
import { ConvexError } from 'convex/values';
import { z } from 'zod';

import { limits } from '../config/limits';
import { createOrgSchema, updateOrgSchema } from '../convex/schema/org.schema';
import { authComponent, createAuth } from './auth';
import { zAuthedMutation, zQuery } from './utils/functions';
import { getOrgDetails } from './utils/queries/getOrgDetails';

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
		const orgDetails = await getOrgDetails(ctx, {
			slug: args.slug,
		});

		if (!orgDetails || !orgDetails.org) {
			throw new ConvexError({
				message: 'Organization not found',
				code: '404',
			});
		}

		if (!orgDetails.permissions.canEdit) {
			throw new ConvexError({
				message: 'User does not have permission',
				code: '403',
			});
		}

		await createAuth(ctx).api.updateOrganization({
			headers: await authComponent.getHeaders(ctx),
			body: {
				organizationId: orgDetails.org?._id,
				data: args,
			},
		});
	},
});

export const getDetails = zQuery({
	args: {
		orgSlug: z.string(),
	},
	handler: async (ctx, args) => {
		const org = await getOrgDetails(ctx, {
			slug: args.orgSlug,
		});

		if (!org?.org) {
			throw new ConvexError({
				message: 'Organization not found',
				code: '404',
			});
		}

		if (!org?.permissions.canView) {
			throw new ConvexError({
				message: 'User does not have permission',
				code: '403',
			});
		}

		return org;
	},
});
