import { v } from 'convex/values';

import { internalMutation } from './_generated/server';

// Local-only fixture. Not a user-facing membership creation endpoint.
export const seed = internalMutation({
	args: {},
	handler: async (ctx) => {
		if (process.env.CONVEX_SITE_URL !== 'http://127.0.0.1:4421')
			throw new Error('Local proof only');
		const userId = await ctx.db.insert('users', {
			email: 'inviter@example.test',
			verified: true,
			verificationGeneration: 0,
			resetGeneration: 0,
		});
		const organizationId = await ctx.db.insert('organizations', {
			name: 'Native invitation live proof',
			slug: 'invitation-' + userId,
		});
		await ctx.db.insert('memberships', { organizationId, userId, role: 'owner' });
		return { userId, organizationId };
	},
});

export const seedSwitching = internalMutation({
	args: { userId: v.id('users') },
	handler: async (ctx, { userId }) => {
		if (process.env.CONVEX_SITE_URL !== 'http://127.0.0.1:4421')
			throw new Error('Local proof only');
		const user = await ctx.db.get(userId);
		if (!user?.verified) throw new Error('Verified recipient required');
		const ownerId = await ctx.db.insert('users', {
			email: 'switch-owner@example.test',
			verified: true,
			verificationGeneration: 0,
			resetGeneration: 0,
		});
		const organizations = [];
		for (const label of ['Switch alpha', 'Switch beta']) {
			const name = label + ' ' + ownerId.slice(-6);
			const organizationId = await ctx.db.insert('organizations', {
				name,
				slug: name.toLowerCase().replace(' ', '-') + '-' + ownerId,
				visibility: 'private',
			});
			await ctx.db.insert('memberships', { organizationId, userId: ownerId, role: 'owner' });
			const membershipId = await ctx.db.insert('memberships', {
				organizationId,
				userId,
				role: 'admin',
			});
			const projectId = await ctx.db.insert('projects', {
				organizationId,
				name: name + ' private project',
				value: 0,
				visibility: 'private',
			});
			organizations.push({ organizationId, membershipId, projectId, name });
		}
		return { ownerId, organizations };
	},
});
