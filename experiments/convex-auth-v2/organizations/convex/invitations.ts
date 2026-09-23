import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

import { ConvexError, v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { identity, manage } from './access';
import { validateProjects } from './organizations';
import { assignableRole } from './schema';

const normalizeEmail = (email: string) => email.trim().toLowerCase();
async function load(ctx: QueryCtx, id: Id<'invitations'>) {
	const invitation = await ctx.db.get(id);
	if (!invitation) throw new ConvexError('INVITATION_UNAVAILABLE');
	return invitation;
}
async function recipient(ctx: QueryCtx, invitation: Doc<'invitations'>) {
	const user = await identity(ctx);
	// This field must be a verified email from the trusted auth adapter, never an OAuth display email.
	if (
		normalizeEmail(user.email ?? (user.githubEmailVerified ? user.githubEmail : '') ?? '') !==
		invitation.email
	)
		throw new ConvexError('WRONG_RECIPIENT');
	return user;
}
function requirePending(invitation: Doc<'invitations'>) {
	if (invitation.status !== 'pending' || invitation.expiresAt <= Date.now())
		throw new ConvexError('INVITATION_UNAVAILABLE');
}
export const createArgs = {
	organizationId: v.id('organizations'),
	email: v.string(),
	role: assignableRole,
	projectIds: v.array(v.id('projects')),
};
export async function createInvitation(
	ctx: MutationCtx,
	args: {
		organizationId: Id<'organizations'>;
		email: string;
		role: 'admin' | 'moderator';
		projectIds: Id<'projects'>[];
	}
) {
	const inviter = await manage(ctx, args.organizationId);
	const email = normalizeEmail(args.email);
	if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		throw new ConvexError('INVALID_EMAIL');
	await validateProjects(ctx, args.organizationId, args.role, args.projectIds);
	const previous = await ctx.db
		.query('invitations')
		.withIndex('by_organizationId_email_status', (q) =>
			q.eq('organizationId', args.organizationId).eq('email', email).eq('status', 'pending')
		)
		.unique();
	if (previous) {
		if (previous.expiresAt > Date.now()) throw new ConvexError('INVITATION_PENDING');
		await ctx.db.patch(previous._id, { status: 'expired', projectIds: [] });
	}
	return ctx.db.insert('invitations', {
		...args,
		email,
		inviterId: inviter.userId,
		status: 'pending',
		expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
	});
}
export const create = mutation({ args: createArgs, handler: createInvitation });
export const accept = mutation({
	args: { invitationId: v.id('invitations') },
	handler: async (ctx, args) => {
		const invitation = await load(ctx, args.invitationId);
		const user = await recipient(ctx, invitation);
		if (!(await ctx.db.get(invitation.organizationId)))
			throw new ConvexError('INVITATION_UNAVAILABLE');
		if (invitation.status === 'accepted') {
			// Idempotency is bound to this exact membership, never recreate one after removal.
			const member = invitation.membershipId && (await ctx.db.get(invitation.membershipId));
			if (
				invitation.acceptedBy !== user._id ||
				!member ||
				member.userId !== user._id ||
				member.organizationId !== invitation.organizationId
			)
				throw new ConvexError('INVITATION_UNAVAILABLE');
			return member._id;
		}
		requirePending(invitation);
		// A stale invitation must not outlive the inviter's authority.
		const inviter = await ctx.db
			.query('memberships')
			.withIndex('by_organizationId_userId', (q) =>
				q.eq('organizationId', invitation.organizationId).eq('userId', invitation.inviterId)
			)
			.unique();
		const inviterUser = await ctx.db.get(invitation.inviterId);
		if (
			!inviterUser?.verified ||
			(inviterUser.systemRole !== 'system:admin' && (!inviter || inviter.role === 'moderator'))
		)
			throw new ConvexError('INVITATION_UNAVAILABLE');
		const existing = await ctx.db
			.query('memberships')
			.withIndex('by_organizationId_userId', (q) =>
				q.eq('organizationId', invitation.organizationId).eq('userId', user._id)
			)
			.unique();
		// Accepting an invitation never updates an existing member's permissions.
		if (existing) throw new ConvexError('ALREADY_MEMBER');
		await validateProjects(ctx, invitation.organizationId, invitation.role, invitation.projectIds);
		const membershipId = await ctx.db.insert('memberships', {
			organizationId: invitation.organizationId,
			userId: user._id,
			role: invitation.role,
		});
		for (const projectId of invitation.projectIds)
			await ctx.db.insert('assignments', { membershipId, projectId });
		await ctx.db.patch(invitation._id, {
			status: 'accepted',
			acceptedBy: user._id,
			membershipId,
			projectIds: [],
		});
		return membershipId;
	},
});
export const cancel = mutation({
	args: { invitationId: v.id('invitations') },
	handler: async (ctx, args) => {
		const invitation = await load(ctx, args.invitationId);
		await manage(ctx, invitation.organizationId);
		requirePending(invitation);
		await ctx.db.patch(invitation._id, { status: 'cancelled', projectIds: [] });
		return null;
	},
});
export const reject = mutation({
	args: { invitationId: v.id('invitations') },
	handler: async (ctx, args) => {
		const invitation = await load(ctx, args.invitationId);
		await recipient(ctx, invitation);
		requirePending(invitation);
		await ctx.db.patch(invitation._id, { status: 'rejected', projectIds: [] });
		return null;
	},
});

export const inspect = query({
	args: { invitationId: v.id('invitations') },
	handler: async (ctx, args) => {
		const invitation = await load(ctx, args.invitationId);
		await recipient(ctx, invitation);
		const organization = await ctx.db.get(invitation.organizationId);
		if (!organization) throw new ConvexError('INVITATION_UNAVAILABLE');
		return {
			organizationName: organization.name,
			role: invitation.role,
			status: invitation.status,
			expiresAt: invitation.expiresAt,
		};
	},
});
