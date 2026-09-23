import { createElement } from 'react';
import { Analytics } from '@bentonow/bento-node-sdk';
import { sha256Hex } from '@convex-dev/auth/lib/crypto';
import { v } from 'convex/values';
import { renderToStaticMarkup } from 'react-dom/server.edge';

import { getEmailCopy } from '../emails/i18n';
import {
	OrganizationInvitationEmail,
	ResetPasswordEmail,
	VerificationEmail,
} from '../emails/index';
import { internal } from './_generated/api';
import { env, internalAction, internalMutation, internalQuery } from './_generated/server';
import { emailCredentials } from './mailConfig';
import { challengePurpose, localeValidator } from './schema';

export const pending = internalQuery({
	args: { challengeId: v.id('authChallenges'), code: v.string() },
	returns: v.union(
		v.null(),
		v.object({
			email: v.string(),
			name: v.string(),
			purpose: challengePurpose,
			locale: localeValidator,
		})
	),
	handler: async (ctx, { challengeId, code }) => {
		const proof = await ctx.db.get('authChallenges', challengeId);
		if (!proof || proof.expiresAt <= Date.now() || proof.hash !== (await sha256Hex(code)))
			return null;
		const user = await ctx.db.get('users', proof.userId);
		if (
			!user?.passwordEmail ||
			(proof.purpose === 'verify'
				? user.status !== 'pendingVerification'
				: user.status !== 'active' || user.passwordEmailVerifiedAt === undefined)
		)
			return null;
		const profile = user.profileId ? await ctx.db.get('profiles', user.profileId) : null;
		return {
			email: user.passwordEmail,
			name: profile?.name || user.registrationName || user.passwordEmail,
			purpose: proof.purpose,
			locale: profile?.locale || user.registrationLocale || 'en-US',
		};
	},
});
export const deliver = internalAction({
	args: { challengeId: v.id('authChallenges'), code: v.string(), attempt: v.number() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const delivery = await ctx.runQuery(internal.mail.pending, {
			challengeId: args.challengeId,
			code: args.code,
		});
		if (!delivery) return null;
		const credentials = emailCredentials();
		if (!credentials) throw new Error('EMAIL_UNAVAILABLE');
		const origin = new URL(env.AUTH_APP_ORIGIN);
		if (origin.origin !== env.AUTH_APP_ORIGIN) throw new Error('AUTH_APP_ORIGIN must be an origin');
		const url = new URL(
			delivery.purpose === 'verify' ? '/auth/verify-email' : '/auth/reset-password',
			origin
		);
		// Fragments stay out of HTTP request/referrer logs. The Start adapter will
		// redeem only after an explicit browser action, never from a mail-scanner GET.
		url.hash = `code=${args.code}`;
		const props = {
			locale: delivery.locale,
			user: { email: delivery.email, name: delivery.name },
			url: url.href,
		};
		const copy = getEmailCopy(delivery.locale);
		const html = `<!DOCTYPE html>${renderToStaticMarkup(createElement(delivery.purpose === 'verify' ? VerificationEmail : ResetPasswordEmail, props))}`;
		const bento = new Analytics({
			authentication: {
				publishableKey: credentials.publishableKey,
				secretKey: credentials.secretKey,
			},
			siteUuid: credentials.siteUuid,
		});
		try {
			const count = await bento.V1.Batch.sendTransactionalEmails({
				emails: [
					{
						to: delivery.email,
						from: credentials.from,
						subject: delivery.purpose === 'verify' ? copy.verification.subject : copy.reset.subject,
						html_body: html,
						transactional: true,
					},
				],
			});
			if (count !== 1) throw new Error('EMAIL_NOT_ACCEPTED');
			console.info('Native auth email accepted', { purpose: delivery.purpose });
		} catch {
			// Never log the SDK exception: it can include the secret-bearing payload.
			if (args.attempt >= 2) throw new Error('AUTH_EMAIL_DELIVERY_FAILED');
			console.warn('Native auth email delivery retry', {
				purpose: delivery.purpose,
				attempt: args.attempt + 1,
			});
			await ctx.scheduler.runAfter(args.attempt === 0 ? 30_000 : 120_000, internal.mail.deliver, {
				...args,
				attempt: args.attempt + 1,
			});
		}
		return null;
	},
});

export const pendingInvitation = internalQuery({
	args: { invitationId: v.id('invitations') },
	handler: async (ctx, { invitationId }) => {
		const invitation = await ctx.db.get('invitations', invitationId);
		if (!invitation || invitation.status !== 'pending' || invitation.expiresAt <= Date.now())
			return null;
		const [organization, inviter] = await Promise.all([
			ctx.db.get('organizations', invitation.organizationId),
			ctx.db.get('users', invitation.inviterId),
		]);
		if (!organization || !inviter?.profileId || inviter.status !== 'active') return null;
		const profile = await ctx.db.get('profiles', inviter.profileId);
		if (!profile) return null;
		return {
			email: invitation.email,
			invitationId,
			inviterEmail: inviter.passwordEmail ?? inviter.githubEmail ?? '',
			inviterName: profile.name,
			locale: profile.locale ?? ('en-US' as const),
			organizationName: organization.name,
			role: invitation.role,
		};
	},
});

export const recordInvitationDelivery = internalMutation({
	args: {
		invitationId: v.id('invitations'),
		status: v.union(v.literal('accepted'), v.literal('failed')),
	},
	returns: v.null(),
	handler: async (ctx, { invitationId, status }) => {
		const invitation = await ctx.db.get('invitations', invitationId);
		if (invitation?.status === 'pending')
			await ctx.db.patch('invitations', invitationId, { deliveryStatus: status });
		return null;
	},
});

function emailDeliveryFailure(error: unknown) {
	const name = error instanceof Error ? error.name : 'UnknownError';
	const message = error instanceof Error ? error.message : '';
	const status = /^\[(\d{3})\]/.exec(message)?.[1];
	return status ? { name, status } : { name };
}

export const deliverInvitation = internalAction({
	args: { invitationId: v.id('invitations'), attempt: v.number() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const delivery = await ctx.runQuery(internal.mail.pendingInvitation, {
			invitationId: args.invitationId,
		});
		if (!delivery) return null;
		const credentials = emailCredentials();
		if (!credentials) throw new Error('EMAIL_UNAVAILABLE');
		const origin = new URL(env.AUTH_APP_ORIGIN);
		if (origin.origin !== env.AUTH_APP_ORIGIN) throw new Error('AUTH_APP_ORIGIN must be an origin');
		const copy = getEmailCopy(delivery.locale);
		const props = {
			locale: delivery.locale,
			organization: { name: delivery.organizationName },
			inviter: {
				user: { email: delivery.inviterEmail, name: delivery.inviterName },
			},
			invitation: { id: delivery.invitationId, role: delivery.role },
			siteUrl: origin.origin,
		};
		const html = `<!DOCTYPE html>${renderToStaticMarkup(createElement(OrganizationInvitationEmail, props))}`;
		const bento = new Analytics({
			authentication: {
				publishableKey: credentials.publishableKey,
				secretKey: credentials.secretKey,
			},
			siteUuid: credentials.siteUuid,
		});
		try {
			const count = await bento.V1.Batch.sendTransactionalEmails({
				emails: [
					{
						to: delivery.email,
						from: credentials.from,
						subject: copy.invitation.subject(delivery.organizationName),
						html_body: html,
						transactional: true,
					},
				],
			});
			if (count !== 1) throw new Error('EMAIL_NOT_ACCEPTED');
			await ctx.runMutation(internal.mail.recordInvitationDelivery, {
				invitationId: args.invitationId,
				status: 'accepted',
			});
			console.info('Native invitation email accepted');
		} catch (error) {
			// Keep the recipient, rendered HTML, and Bento credentials out of logs,
			// while retaining enough information to distinguish rate limiting,
			// authorization, and request validation failures.
			console.warn('Native invitation email rejected', emailDeliveryFailure(error));
			if (args.attempt >= 2) {
				await ctx.runMutation(internal.mail.recordInvitationDelivery, {
					invitationId: args.invitationId,
					status: 'failed',
				});
				throw new Error('INVITATION_EMAIL_DELIVERY_FAILED');
			}
			console.warn('Native invitation email delivery retry', { attempt: args.attempt + 1 });
			await ctx.scheduler.runAfter(
				args.attempt === 0 ? 30_000 : 120_000,
				internal.mail.deliverInvitation,
				{ invitationId: args.invitationId, attempt: args.attempt + 1 }
			);
		}
		return null;
	},
});
