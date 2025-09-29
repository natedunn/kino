import { userInfo } from 'os';

import { BetterAuthError } from 'better-auth';
import { ConvexError } from 'convex/values';
import z from 'zod';

import { LIMITS } from '../config/limits';
import { createOrgSchema, updateOrgSchema } from '../convex/schema/org.schema';
import { components } from './_generated/api';
import { authComponent, createAuth } from './auth';
import { safeGetUser } from './user.utils';
import { zAuthedMutation, zAuthedQuery, zQuery } from './utils/functions';

export const create = zAuthedMutation({
	args: createOrgSchema,
	handler: async (ctx, args) => {
		const headers = await authComponent.getHeaders(ctx);

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
	},
});

export const update = zAuthedMutation({
	args: updateOrgSchema,
	handler: async (ctx, args) => {
		const orgDetails = await ctx.runQuery(components.betterAuth.org.getDetails, {
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
		slug: z.string(),
	},
	handler: async (ctx, args) => {
		const orgDetails = await ctx.runQuery(components.betterAuth.org.getDetails, args);

		if (!orgDetails) {
			throw new ConvexError({
				message: 'Organization details not found',
				code: '404',
			});
		}

		if (!orgDetails?.org) {
			throw new ConvexError({
				message: 'Organization not found',
				code: '404',
			});
		}

		if (!orgDetails?.permissions.canView) {
			throw new ConvexError({
				message: 'User does not have permission',
				code: '403',
			});
		}

		return orgDetails;
	},
});

export const limits = zAuthedQuery({
	args: {
		slug: z.string(),
	},
	handler: async (ctx, args) => {
		const createResponse = (permissions: { canAddProjects: boolean }) => permissions;

		const user = await safeGetUser(ctx);

		const projects = await ctx.db
			.query('project')
			.withIndex('by_orgSlug', (q) => q.eq('orgSlug', args.slug))
			.collect();

		let limit: number;

		if (user?.role === 'admin') {
			limit = LIMITS.ADMIN.MAX_PROJECTS;
		} else {
			limit = LIMITS.FREE.MAX_PROJECTS;
		}

		const underLimit = projects.length < limit;

		return createResponse({
			canAddProjects: underLimit,
		});
	},
});
