import { httpRouter } from 'convex/server';
import { z } from 'zod';

import {
	githubCodeSchema,
	githubNodeIdSchema,
	githubStateSchema,
	githubStateValueSchema,
	githubTitleSchema,
	githubUrlSchema,
	webhookActionSchema,
	webhookDeliveryIdSchema,
	webhookEventSchema,
} from '../shared/validation';
import { internal } from './_generated/api';
import { env, httpAction } from './_generated/server';
import {
	createInstallationToken,
	exchangeGitHubSetupCode,
	findAccessibleInstallationRepositoryIds,
	getAppInstallation,
	listUserInstallations,
	sanitizeGitHubInstallationDetails,
	verifyGitHubWebhookSignature,
} from './relayClient';
import { findDeletedInstallationIds, githubSettingsUrl } from './relayRoutes.lib';

const http = httpRouter();
http.route({
	path: '/api/github/callback',
	method: 'GET',
	handler: httpAction(async (ctx, request) => {
		try {
			const params = new URL(request.url).searchParams;
			const state = githubStateSchema.parse(params.get('state')),
				code = githubCodeSchema.parse(params.get('code'));
			// Check signature, target, expiry and current authorization before exchanging a code.
			const context = await ctx.runMutation(internal.relay.callbackContext, { state });
			const token = await exchangeGitHubSetupCode(code);
			const accessible = await listUserInstallations(token);
			const installationId = params.has('installation_id')
				? z.coerce.number().int().positive().parse(params.get('installation_id'))
				: undefined;
			if (installationId && !accessible.some((i) => i.id === installationId))
				throw new Error('UNAUTHORIZED_INSTALLATION');
			const candidates = installationId ? [await getAppInstallation(installationId)] : accessible;
			const deletedInstallationIds = await findDeletedInstallationIds({
				knownInstallationIds: context.knownInstallationIds,
				userInstallationIds: new Set(accessible.map((i) => i.id)),
			});
			if (params.get('setup_action') === 'remove' && installationId)
				deletedInstallationIds.push(installationId);
			const installations = [];
			for (const installation of candidates) {
				if (deletedInstallationIds.includes(installation.id)) continue;
				const repositories = context.targets
					.filter((t) => t.accountId === installation.account?.id)
					.flatMap((t) => t.repositories);
				const authorizedRepositoryIds = repositories.length
					? await findAccessibleInstallationRepositoryIds({
							repositories,
							token: (
								await createInstallationToken({ installationId: installation.id, mode: 'read' })
							).token,
						})
					: [];
				installations.push({
					installation: sanitizeGitHubInstallationDetails(installation),
					authorizedRepositoryIds,
				});
			}
			const result = await ctx.runMutation(internal.relay.complete, {
				state,
				installations,
				deletedInstallationIds,
			});
			return Response.redirect(
				githubSettingsUrl({ ...result, siteUrl: env.AUTH_APP_ORIGIN, status: 'connected' }),
				302
			);
		} catch {
			return Response.redirect(`${env.AUTH_APP_ORIGIN}/dashboard?github=error`, 302);
		}
	}),
});
const payloadSchema = z.object({
	repositories_removed: z
		.array(z.object({ id: z.number().int() }))
		.max(500)
		.optional(),
	action: webhookActionSchema,
	installation: z
		.object({
			id: z.number().int(),
			events: z.array(z.string().max(80)).max(100).optional(),
			permissions: z.record(z.string().max(100), z.string().max(100)).optional(),
		})
		.optional(),
	repository: z.object({ id: z.number().int() }).optional(),
	issue: z
		.object({
			node_id: githubNodeIdSchema,
			number: z.number().int(),
			title: githubTitleSchema,
			state: githubStateValueSchema,
			html_url: githubUrlSchema,
		})
		.optional(),
});
http.route({
	path: '/api/github/webhook',
	method: 'POST',
	handler: httpAction(async (ctx, request) => {
		const body = await request.text();
		if (body.length > 2_000_000) return new Response('Payload too large', { status: 413 });
		if (!(await verifyGitHubWebhookSignature(body, request.headers.get('x-hub-signature-256'))))
			return new Response('Unauthorized', { status: 401 });
		const deliveryId = webhookDeliveryIdSchema.safeParse(request.headers.get('x-github-delivery')),
			event = webhookEventSchema.safeParse(request.headers.get('x-github-event'));
		if (!deliveryId.success || !event.success)
			return new Response('Invalid headers', { status: 400 });
		let parsed: ReturnType<typeof payloadSchema.parse>;
		try {
			parsed = payloadSchema.parse(JSON.parse(body));
		} catch {
			return new Response('Invalid payload', { status: 400 });
		}
		const result = await ctx.runMutation(internal.relay.webhook, {
			deliveryId: deliveryId.data,
			event: event.data,
			action: parsed.action,
			installationId: parsed.installation?.id,
			events: parsed.installation?.events,
			permissions: parsed.installation?.permissions,
			removedRepositoryIds: parsed.repositories_removed?.map((r) => r.id),
			...(parsed.issue && parsed.repository
				? {
						issue: {
							repositoryId: parsed.repository.id,
							nodeId: parsed.issue.node_id,
							number: parsed.issue.number,
							title: parsed.issue.title,
							state: parsed.issue.state,
							url: parsed.issue.html_url,
						},
					}
				: {}),
		});
		return Response.json({ ok: true, ...result });
	}),
});
export default http;
