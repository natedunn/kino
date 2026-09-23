import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

import { MINUTE, RateLimiter } from '@convex-dev/rate-limiter';
import { ConvexError, v } from 'convex/values';

import { components, internal } from './_generated/api';
import { mutation, query } from './_generated/server';
import { findMembership, requireOrganizationManager } from './access';
import { getCurrentUser, requireCurrentUser } from './identity';
import { emailCredentials } from './mailConfig';
import { MAX_ORGANIZATION_MEMBERS, validateOrganizationProjects } from './organizations';
import { assignableOrganizationRole } from './schema';

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const invitationLimits = new RateLimiter(components.authLimits, {
	create: { kind: 'token bucket', rate: 10, period: MINUTE, capacity: 10 },
});

function normalizeEmail(raw: string) {
	const email = raw.trim().toLowerCase();
	if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		throw new ConvexError('INVALID_EMAIL');
	return email;
}

function verifiedEmail(user: Doc<'users'>) {
	if (user.passwordEmail && user.passwordEmailVerifiedAt !== undefined) return user.passwordEmail;
	if (user.githubEmail && user.githubEmailVerifiedAt !== undefined) return user.githubEmail;
	return null;
}

async function load(ctx: QueryCtx, invitationId: Id<'invitations'>) {
	const invitation = await ctx.db.get('invitations', invitationId);
	if (!invitation) throw new ConvexError('INVITATION_UNAVAILABLE');
	return invitation;
}

function requirePending(invitation: Doc<'invitations'>) {
	if (invitation.status !== 'pending' || invitation.expiresAt <= Date.now())
		throw new ConvexError('INVITATION_UNAVAILABLE');
}

async function requireRecipient(ctx: QueryCtx, invitation: Doc<'invitations'>) {
	const user = await requireCurrentUser(ctx);
	if (verifiedEmail(user)?.trim().toLowerCase() !== invitation.email)
		throw new ConvexError('WRONG_RECIPIENT');
	return user;
}

export const create = mutation({
	args: {
		organizationId: v.id('organizations'),
		email: v.string(),
		role: assignableOrganizationRole,
		projectIds: v.array(v.id('projects')),
	},
	returns: v.id('invitations'),
	handler: async (ctx, args) => {
		const { user } = await requireOrganizationManager(ctx, args.organizationId);
		if (!emailCredentials()) throw new ConvexError('EMAIL_UNAVAILABLE');
		if (!(await invitationLimits.limit(ctx, 'create', { key: user._id })).ok)
			throw new ConvexError('RATE_LIMITED');
		const email = normalizeEmail(args.email);
		await validateOrganizationProjects(ctx, args.organizationId, args.role, args.projectIds);
		const previous = await ctx.db
			.query('invitations')
			.withIndex('by_organizationId_and_email_and_status', (q) =>
				q.eq('organizationId', args.organizationId).eq('email', email).eq('status', 'pending')
			)
			.unique();
		if (previous) {
			if (previous.expiresAt > Date.now()) throw new ConvexError('INVITATION_PENDING');
			await ctx.db.patch('invitations', previous._id, { status: 'expired', projectIds: [] });
		}
		const invitationId = await ctx.db.insert('invitations', {
			organizationId: args.organizationId,
			email,
			role: args.role,
			projectIds: args.projectIds,
			inviterId: user._id,
			expiresAt: Date.now() + INVITATION_LIFETIME_MS,
			status: 'pending',
		});
		await ctx.scheduler.runAfter(0, internal.mail.deliverInvitation, {
			invitationId,
			attempt: 0,
		});
		return invitationId;
	},
});

export const inspect = query({
	args: { invitationId: v.id('invitations') },
	returns: v.union(
		v.object({ state: v.literal('unavailable') }),
		v.object({ state: v.literal('wrong_account') }),
		v.object({
			state: v.literal('already_accepted'),
			organizationName: v.string(),
			organizationSlug: v.string(),
		}),
		v.object({
			state: v.literal('pending'),
			organizationName: v.string(),
			organizationSlug: v.string(),
			role: assignableOrganizationRole,
			expiresAt: v.number(),
		})
	),
	handler: async (ctx, { invitationId }) => {
		const user = await getCurrentUser(ctx);
		if (!user) return { state: 'unavailable' as const };
		const invitation = await ctx.db.get('invitations', invitationId);
		if (!invitation) return { state: 'unavailable' as const };
		if (verifiedEmail(user)?.trim().toLowerCase() !== invitation.email)
			return { state: 'wrong_account' as const };
		const organization = await ctx.db.get('organizations', invitation.organizationId);
		if (!organization) return { state: 'unavailable' as const };
		if (invitation.status === 'accepted') {
			const membership =
				invitation.membershipId && (await ctx.db.get('memberships', invitation.membershipId));
			return invitation.acceptedBy === user._id && membership?.userId === user._id
				? {
						state: 'already_accepted' as const,
						organizationName: organization.name,
						organizationSlug: organization.slug,
					}
				: { state: 'unavailable' as const };
		}
		if (invitation.status !== 'pending' || invitation.expiresAt <= Date.now())
			return { state: 'unavailable' as const };
		return {
			state: 'pending' as const,
			organizationName: organization.name,
			organizationSlug: organization.slug,
			role: invitation.role,
			expiresAt: invitation.expiresAt,
		};
	},
});

export const accept = mutation({
	args: { invitationId: v.id('invitations') },
	returns: v.object({ membershipId: v.id('memberships'), organizationSlug: v.string() }),
	handler: async (ctx, { invitationId }) => {
		const invitation = await load(ctx, invitationId);
		const user = await requireRecipient(ctx, invitation);
		const organization = await ctx.db.get('organizations', invitation.organizationId);
		if (!organization) throw new ConvexError('INVITATION_UNAVAILABLE');
		if (invitation.status === 'accepted') {
			const membership =
				invitation.membershipId && (await ctx.db.get('memberships', invitation.membershipId));
			if (
				invitation.acceptedBy !== user._id ||
				!membership ||
				membership.userId !== user._id ||
				membership.organizationId !== invitation.organizationId
			)
				throw new ConvexError('INVITATION_UNAVAILABLE');
			return { membershipId: membership._id, organizationSlug: organization.slug };
		}
		requirePending(invitation);
		const inviter = await ctx.db.get('users', invitation.inviterId);
		const inviterMembership = await findMembership(
			ctx,
			invitation.organizationId,
			invitation.inviterId
		);
		if (
			!inviter ||
			inviter.status !== 'active' ||
			(inviter.systemRole !== 'system:admin' &&
				(!inviterMembership || inviterMembership.role === 'moderator'))
		)
			throw new ConvexError('INVITATION_UNAVAILABLE');
		if (await findMembership(ctx, invitation.organizationId, user._id))
			throw new ConvexError('ALREADY_MEMBER');
		const count = await ctx.db
			.query('memberships')
			.withIndex('by_organizationId_and_role', (q) =>
				q.eq('organizationId', invitation.organizationId)
			)
			.take(MAX_ORGANIZATION_MEMBERS + 1);
		if (count.length >= MAX_ORGANIZATION_MEMBERS) throw new ConvexError('MEMBERSHIP_LIMIT_REACHED');
		await validateOrganizationProjects(
			ctx,
			invitation.organizationId,
			invitation.role,
			invitation.projectIds
		);
		const membershipId = await ctx.db.insert('memberships', {
			organizationId: invitation.organizationId,
			userId: user._id,
			role: invitation.role,
		});
		for (const projectId of invitation.projectIds) {
			await ctx.db.insert('projectModeratorAssignments', { membershipId, projectId });
		}
		await ctx.db.patch('invitations', invitation._id, {
			status: 'accepted',
			acceptedBy: user._id,
			membershipId,
			projectIds: [],
		});
		return { membershipId, organizationSlug: organization.slug };
	},
});

export const reject = mutation({
	args: { invitationId: v.id('invitations') },
	returns: v.null(),
	handler: async (ctx, { invitationId }) => {
		const invitation = await load(ctx, invitationId);
		await requireRecipient(ctx, invitation);
		requirePending(invitation);
		await ctx.db.patch('invitations', invitation._id, {
			status: 'rejected',
			projectIds: [],
		});
		return null;
	},
});

export const cancel = mutation({
	args: { invitationId: v.id('invitations') },
	returns: v.null(),
	handler: async (ctx, { invitationId }) => {
		const invitation = await load(ctx, invitationId);
		await requireOrganizationManager(ctx, invitation.organizationId);
		requirePending(invitation);
		await ctx.db.patch('invitations', invitation._id, {
			status: 'cancelled',
			projectIds: [],
		});
		return null;
	},
});

export const listPending = query({
	args: { organizationId: v.id('organizations') },
	returns: v.array(
		v.object({
			id: v.id('invitations'),
			email: v.string(),
			role: assignableOrganizationRole,
			assignedProjectCount: v.number(),
			expiresAt: v.number(),
			deliveryStatus: v.union(v.null(), v.literal('accepted'), v.literal('failed')),
		})
	),
	handler: async (ctx, { organizationId }) => {
		await requireOrganizationManager(ctx, organizationId);
		const invitations = await ctx.db
			.query('invitations')
			.withIndex('by_organizationId_and_status', (q) =>
				q.eq('organizationId', organizationId).eq('status', 'pending')
			)
			.take(MAX_ORGANIZATION_MEMBERS + 1);
		if (invitations.length > MAX_ORGANIZATION_MEMBERS)
			throw new ConvexError('INVITATION_LIMIT_REACHED');
		return invitations.map((invitation) => ({
			id: invitation._id,
			email: invitation.email,
			role: invitation.role,
			assignedProjectCount: invitation.projectIds.length,
			expiresAt: invitation.expiresAt,
			deliveryStatus: invitation.deliveryStatus ?? null,
		}));
	},
});
