import { Analytics } from '@bentonow/bento-node-sdk';
import { v } from 'convex/values';

import { internal } from './_generated/api';
import { env, internalAction, internalMutation, internalQuery } from './_generated/server';
import { emailCredentials } from './mailConfig';

export const pending = internalQuery({
	args: { alertId: v.id('operationalAlerts') },
	returns: v.union(
		v.null(),
		v.object({
			kind: v.string(),
			state: v.string(),
			targetId: v.string(),
		})
	),
	handler: async (ctx, { alertId }) => {
		const alert = await ctx.db.get('operationalAlerts', alertId);
		if (!alert || alert.resolvedAt !== undefined) return null;
		return { kind: alert.kind, state: alert.state, targetId: alert.targetId };
	},
});

export const record = internalMutation({
	args: {
		alertId: v.id('operationalAlerts'),
		status: v.union(v.literal('accepted'), v.literal('failed'), v.literal('disabled')),
		attempt: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const alert = await ctx.db.get('operationalAlerts', args.alertId);
		if (!alert || alert.resolvedAt !== undefined) return null;
		const now = Date.now();
		await ctx.db.patch('operationalAlerts', alert._id, {
			deliveryStatus: args.status,
			attempt: args.attempt,
			lastAttemptAt: now,
			lastSentAt: args.status === 'accepted' ? now : alert.lastSentAt,
			scheduledAt: undefined,
		});
		return null;
	},
});

export const deliver = internalAction({
	args: { alertId: v.id('operationalAlerts'), attempt: v.number() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const alert = await ctx.runQuery(internal.operationsMail.pending, { alertId: args.alertId });
		if (!alert) return null;
		const credentials = emailCredentials();
		const recipient = env.NATIVE_OPERATIONS_ALERT_EMAIL;
		if (!credentials || !recipient) {
			await ctx.runMutation(internal.operationsMail.record, {
				...args,
				status: 'disabled',
			});
			return null;
		}
		const adminUrl = new URL('/admin', env.AUTH_APP_ORIGIN).href;
		const title = `${label(alert.kind)} is ${alert.state}`;
		const html = `<!DOCTYPE html><html><body><h1>${escapeHtml(title)}</h1><p>Target: <code>${escapeHtml(alert.targetId)}</code></p><p><a href="${escapeHtml(adminUrl)}">Open Kino system operations</a></p></body></html>`;
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
						to: recipient,
						from: credentials.from,
						subject: `[Kino operations] ${title}`,
						html_body: html,
						transactional: true,
					},
				],
			});
			if (count !== 1) throw new Error('EMAIL_NOT_ACCEPTED');
			await ctx.runMutation(internal.operationsMail.record, {
				...args,
				status: 'accepted',
			});
			console.info('Native operations alert accepted', { kind: alert.kind, state: alert.state });
		} catch {
			if (args.attempt < 2) {
				await ctx.scheduler.runAfter(
					args.attempt === 0 ? 30_000 : 120_000,
					internal.operationsMail.deliver,
					{ alertId: args.alertId, attempt: args.attempt + 1 }
				);
			} else {
				await ctx.runMutation(internal.operationsMail.record, {
					...args,
					status: 'failed',
				});
			}
			console.warn('Native operations alert delivery retry', {
				kind: alert.kind,
				attempt: args.attempt + 1,
			});
		}
		return null;
	},
});

function label(kind: string) {
	return kind.replaceAll('_', ' ');
}

function escapeHtml(value: string) {
	return value.replace(/[&<>"']/g, (character) => {
		const entities: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;',
		};
		return entities[character];
	});
}
