import { Analytics } from '@bentonow/bento-node-sdk';

import { getBentoEnv } from './get-env';

/**
 * Shared Bento access for the whole backend.
 *
 * Deliberately Convex-agnostic so it can be used from anywhere that runs in an
 * action/HTTP-action context (network I/O is required):
 * - the Better Auth send callbacks (convex/functions/auth.ts)
 * - the general-purpose `sendTransactionalEmail` action (convex/functions/email.ts)
 *
 * Do NOT call `sendEmail` from a query or mutation — only actions and HTTP
 * actions may make outbound requests.
 *
 * The official SDK runs fine in Convex's default V8 runtime: it has zero
 * dependencies, imports no Node built-ins, calls global `fetch`, and base64s
 * via `btoa` (its `Buffer` branch is a guarded fallback Convex never reaches,
 * since Convex provides `btoa`).
 */

type BentoCredentials = {
	publishableKey: string;
	secretKey: string;
	siteUuid: string;
	from: string;
};

function requireCredentials(): BentoCredentials {
	const { publishableKey, secretKey, siteUuid, from } = getBentoEnv();
	const missing = [
		!publishableKey && 'BENTO_PUBLISHABLE_KEY',
		!secretKey && 'BENTO_SECRET_KEY',
		!siteUuid && 'BENTO_SITE_UUID',
		!from && 'BENTO_FROM',
	].filter((name): name is string => Boolean(name));

	if (!publishableKey || !secretKey || !siteUuid || !from) {
		throw new Error(
			`${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not set. ` +
				'Add to convex/.env and run `npx kitcn env push` (the Convex backend ' +
				'reads these, not the root .env.local).'
		);
	}

	return { publishableKey, secretKey, siteUuid, from };
}

export type SendEmailArgs = {
	/** Recipient address, or several (one Bento email is queued per recipient). */
	to: string | Array<string>;
	subject: string;
	/** HTML body — Bento's transactional API is HTML-only (no plain text). */
	html: string;
};

/**
 * Send a transactional email through Bento. Reusable building block — call it
 * from Better Auth callbacks, scheduled jobs, or the send action. Resolves to
 * the count of emails Bento accepted for delivery.
 *
 * The `from` is fixed to `BENTO_FROM`, which must exactly match a verified
 * Author in Bento — Bento rejects any other sender. `transactional: true` tells
 * Bento to deliver even to unsubscribed recipients (that flag is *only* an
 * unsubscribe bypass; it is not what classifies the send).
 *
 * Bento accepts one recipient per email object, so an array of `to` fans out to
 * one entry each.
 */
export async function sendEmail(args: SendEmailArgs): Promise<number> {
	const { publishableKey, secretKey, siteUuid, from } = requireCredentials();
	const recipients = Array.isArray(args.to) ? args.to : [args.to];
	const to = recipients.join(', ');

	const bento = new Analytics({
		authentication: { publishableKey, secretKey },
		siteUuid,
	});

	let accepted: number;
	try {
		accepted = await bento.V1.Batch.sendTransactionalEmails({
			emails: recipients.map((recipient) => ({
				to: recipient,
				from,
				subject: args.subject,
				html_body: args.html,
				transactional: true,
			})),
		});
	} catch (error) {
		// Log before rethrowing: the caller is usually a Better Auth background
		// task, which reports the failure without recipient/subject context.
		const detail = error instanceof Error ? error.message : String(error);
		console.error(`[bento] FAILED to send "${args.subject}" to ${to}: ${detail}`);
		throw error;
	}

	// Log successes too. Bento accepting a send says nothing about whether it
	// landed (it may still be queued, junked, or dropped) — without this line a
	// delivered mail and a never-sent one look identical in the Convex logs.
	console.log(`[bento] sent "${args.subject}" to ${to} (accepted ${accepted}) from ${from}`);

	return accepted;
}
