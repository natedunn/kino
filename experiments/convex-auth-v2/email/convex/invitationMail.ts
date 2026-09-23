import { makeFunctionReference } from 'convex/server';
import { v } from 'convex/values';

import { renderOrganizationInvitationEmail } from '../../../../convex/emails/send';
import { sendEmail } from '../../../../convex/lib/bento';
import { internalAction, internalMutation, internalQuery } from './_generated/server';

// Fixed proof origin, not supplied by a browser or an invitation creator.
export const INVITATION_ORIGIN = 'http://127.0.0.1:5181';
export const payload = internalQuery({
	args: { invitationId: v.id('invitations') },
	handler: async (ctx, args) => {
		const invitation = await ctx.db.get(args.invitationId);
		if (!invitation || invitation.status !== 'pending') return null;
		const organization = await ctx.db.get(invitation.organizationId);
		const inviter = await ctx.db.get(invitation.inviterId);
		if (!organization || !inviter) return null;
		return { invitation, organization, inviter };
	},
});
export const deliver = internalAction({
	args: { invitationId: v.id('invitations') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const data = await ctx.runQuery(
			makeFunctionReference<
				'query',
				typeof args,
				{
					invitation: { _id: string; email: string; role: string; expiresAt: number };
					organization: { name: string };
					inviter: { email?: string; githubEmail?: string };
				} | null
			>('invitationMail:payload'),
			args
		);
		if (!data || data.invitation.expiresAt <= Date.now()) return null;
		if (data.invitation.email !== process.env.PROOF_EMAIL)
			throw new Error('Unexpected proof recipient');
		const rendered = renderOrganizationInvitationEmail({
			locale: 'en-US',
			invitation: { id: data.invitation._id, role: data.invitation.role },
			organization: { name: data.organization.name },
			inviter: { user: { email: data.inviter.email ?? data.inviter.githubEmail ?? '' } },
			siteUrl: INVITATION_ORIGIN,
		});
		try {
			const accepted = await sendEmail({ to: data.invitation.email, ...rendered });
			if (accepted !== 1) throw new Error('Invitation email was not accepted');
			await ctx.runMutation(makeFunctionReference<'mutation'>('invitationMail:recordDelivery'), {
				...args,
				status: 'accepted',
			});
		} catch {
			await ctx.runMutation(makeFunctionReference<'mutation'>('invitationMail:recordDelivery'), {
				...args,
				status: 'failed',
			});
			throw new Error('Invitation delivery failed');
		}
		return null;
	},
});

export const recordDelivery = internalMutation({
	args: {
		invitationId: v.id('invitations'),
		status: v.union(v.literal('accepted'), v.literal('failed')),
	},
	handler: async (ctx, args) => {
		if (await ctx.db.get(args.invitationId))
			await ctx.db.patch(args.invitationId, { deliveryStatus: args.status });
		return null;
	},
});
