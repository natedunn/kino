// import type { BetterAuthError } from 'better-auth/react';

import { getOrgAdapter } from 'better-auth/plugins';
import { zodToConvex } from 'convex-helpers/server/zod4';
import { ConvexError } from 'convex/values';
import * as z from 'zod';

import { LIMITS } from '../config/limits';
import { createOrgSchema, updateOrgSchema } from '../convex/schema/org.schema';
import { components } from './_generated/api';
import { authComponent, createAuth } from './auth';
import { getMyProfile } from './profile.lib';
import { mutation, query } from './utils/functions';

export const create = mutation({
	args: zodToConvex(createOrgSchema),
	handler: async (ctx, args) => {
		// await verify.auth(ctx, {
		// 	throw: true,
		// });
		const userIdentity = await ctx.auth.getUserIdentity();

		if (!userIdentity) {
			throw new ConvexError({
				message: 'User not authenticated',
				code: '401',
			});
		}

		const { auth, headers } = await authComponent.getAuth(createAuth, ctx);

		await auth.api
			.createOrganization({
				body: args,
				headers,
			})
			.catch(() => {
				throw new Error('Not able to create an organization.');
				// TODO: Set this properly again once fixe
				// throw new ConvexError({
				// 	message: error.message,
				// 	code: '500',
				// });
			});
	},
});

export const update = mutation({
	args: zodToConvex(updateOrgSchema),
	handler: async (ctx, args) => {
		const { auth, headers } = await authComponent.getAuth(createAuth, ctx);

		// await verify.auth(ctx, {
		// 	throw: true,
		// });

		const userIdentity = await ctx.auth.getUserIdentity();

		if (!userIdentity) {
			throw new ConvexError({
				code: '401',
				message: 'User not authenticated',
			});
		}

		const orgDetails = await ctx.runQuery(components.betterAuth.org.getDetails, {
			slug: args.currentSlug,
		});

		if (!orgDetails || !orgDetails.org || !orgDetails.org._id) {
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

		const { currentSlug, ...data } = args;

		await auth.api.updateOrganization({
			headers,
			body: {
				organizationId: orgDetails.org._id,
				data: {
					...data,
					slug: args.updatedSlug ?? currentSlug,
				},
			},
		});
	},
});

export const getDetails = query({
	args: zodToConvex(z.object({ slug: z.string() })),
	handler: async (ctx, args) => {
		const orgDetails = await ctx.runQuery(components.betterAuth.org.getDetails, args);

		if (!orgDetails) {
			throw new ConvexError({
				message: 'Organization details not found',
				code: '404',
			});
		}

		// if (!orgDetails?.org) {
		// 	throw new ConvexError({
		// 		message: 'Organization not found',
		// 		code: '404',
		// 	});
		// }

		if (!orgDetails?.permissions.canView) {
			throw new ConvexError({
				message: 'User does not have permission',
				code: '403',
			});
		}

		return orgDetails;
	},
});

export const getMyPermission = query({
	args: zodToConvex(
		z.object({
			slug: z.string(),
		})
	),
	handler: async (ctx, args) => {
		// await verify.auth(ctx, {
		// 	throw: true,
		// });
		const userIdentity = await ctx.auth.getUserIdentity();

		if (!userIdentity) {
		}

		const createResponse = (permissions: { canAddProjects: boolean }) => permissions;

		const user = await getMyProfile(ctx);

		const projects = await ctx.db
			.query('project')
			.withIndex('by_orgSlug', (q) => q.eq('orgSlug', args.slug))
			.collect();

		let limit: number;

		if (user?.role === 'system:admin') {
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

export const findMyOrgs = query({
	args: {},
	handler: async (ctx) => {
		const user = await authComponent.safeGetAuthUser(ctx);

		if (!user?.profileId) {
			return null;
		}

		// const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
		const auth = createAuth(ctx);
		const headers = await authComponent.getHeaders(ctx);

		const teams = await auth.api.listOrganizations({
			headers,
		});

		// TODO reimplement this
		// let limit = LIMITS.FREE.MAX_ORGS;
		let limit: number;
		if (user?.role === 'admin') {
			limit = LIMITS.ADMIN.MAX_ORGS;
		} else {
			limit = LIMITS.FREE.MAX_ORGS;
		}

		return { teams, underLimit: teams.length < limit };
	},
});
