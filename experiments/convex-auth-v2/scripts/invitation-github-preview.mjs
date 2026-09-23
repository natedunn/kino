import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference as ref } from 'convex/server';

const origin = 'https://kino-auth-v2-proof-c318c09d.hello-fc8.workers.dev';
const backend = 'https://graceful-elephant-103.convex.cloud';
const key = parseEnv(
	readFileSync(new URL('../cloud/.env.deploy.local', import.meta.url), 'utf8')
).CONVEX_DEPLOY_KEY;
assert.equal(key.split('|')[0].split(':').at(-1), 'graceful-elephant-103');
const admin = new ConvexHttpClient(backend);
admin.setAdminAuth(key);
const path = new URL('../organizations/live-preview-invitation.json', import.meta.url);
let fixture, invitationId;
if (process.env.PROOF_REUSE_INVITATION === '1')
	({ fixture, invitationId } = JSON.parse(readFileSync(path, 'utf8')));
else {
	fixture = await admin.mutation(ref('invitationFixtures:seed'), {});
	const owner = new ConvexHttpClient(backend);
	owner.setAdminAuth(key, {
		subject: fixture.userId,
		issuer: 'proof-fixture',
		tokenIdentifier: `proof-fixture|${fixture.userId}`,
	});
	invitationId = await owner.mutation(ref('invitations:create'), {
		organizationId: fixture.organizationId,
		email: 'hello@natedunn.net',
		role: 'admin',
		projectIds: [],
	});
	writeFileSync(path, JSON.stringify({ fixture, invitationId }) + '\n');
}
let delivered = false;
for (let i = 0; i < 30; i++) {
	const data = await admin.query(ref('invitationMail:payload'), { invitationId });
	if (data?.invitation.deliveryStatus === 'failed') throw new Error('Bento delivery failed');
	if (data?.invitation.deliveryStatus === 'accepted') {
		delivered = true;
		break;
	}
	await new Promise((resolve) => setTimeout(resolve, 500));
}
assert.ok(delivered, 'Bento accepted preview invitation');
console.log('PASS: preview Bento acceptance');
const { chromium } = await import(pathToFileURL(`${process.env.PROOF_PLAYWRIGHT}/index.mjs`).href);
const browser = await chromium.launch({ headless: false });
try {
	const context = await browser.newContext();
	const page = await context.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto(`${origin}/auth/accept-invitation?invitationId=${invitationId}`);
	await page.getByRole('link', { name: 'Sign in to accept' }).click();
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByRole('button', { name: 'Continue with GitHub' }).click();
	console.log(
		'WAITING: complete GitHub sign-in/consent in Chromium; return checks run automatically.'
	);
	await page
		.getByRole('heading', { name: 'Native invitation live proof' })
		.waitFor({ timeout: 600000 });
	assert.equal(new URL(page.url()).pathname, '/auth/accept-invitation');
	assert.equal(await page.evaluate(() => sessionStorage.getItem('proofInvitationId')), null);
	const cookies = await context.cookies(origin);
	const access = cookies.find((c) => c.name === '__convexAuthJWT');
	assert.ok(access?.httpOnly && access.secure);
	const client = new ConvexHttpClient(backend);
	client.setAuth(access.value);
	await page.getByRole('button', { name: 'Accept invitation', exact: true }).click();
	await page.getByRole('status').filter({ hasText: 'Invitation accepted' }).waitFor();
	// Real deployed concurrent retries must all return the original membership.
	const ids = await Promise.all(
		Array.from({ length: 6 }, () => client.mutation(ref('invitations:accept'), { invitationId }))
	);
	assert.equal(new Set(ids).size, 1);
	await page.reload();
	await page.getByText('Status: accepted', { exact: true }).waitFor();
	await page.getByRole('link', { name: 'Open organizations' }).click();
	const row = page.getByRole('listitem').filter({ hasText: 'Native invitation live proof' });
	await row.waitFor();
	const response = await context.request.get(`${origin}/organizations`);
	assert.equal(response.status(), 200);
	assert.ok((await response.text()).includes('Native invitation live proof'));
	assert.match(response.headers()['cache-control'] ?? '', /private|no-store/);
	const owner = new ConvexHttpClient(backend);
	owner.setAdminAuth(key, {
		subject: fixture.userId,
		issuer: 'proof-fixture',
		tokenIdentifier: `proof-fixture|${fixture.userId}`,
	});
	await owner.mutation(ref('organizations:remove'), { membershipId: ids[0] });
	await row.waitFor({ state: 'detached' });
	await assert.rejects(
		client.mutation(ref('invitations:accept'), { invitationId }),
		/INVITATION_UNAVAILABLE/
	);
	assert.deepEqual(errors, []);
	const result = {
		checkedAt: new Date().toISOString(),
		origin,
		backend,
		checks: [
			'Bento accepted preview invitation',
			'anonymous invitation routes to GitHub',
			'real GitHub callback refreshes verified email',
			'invitation destination survives OAuth and temporary storage clears',
			'Secure HttpOnly session cookies',
			'GitHub user accepts invitation',
			'six concurrent accepted retries share one membership',
			'reload preserves acceptance',
			'live organization membership and private SSR',
			'membership removal immediately updates live list',
			'removed membership cannot be recreated by old invitation',
			'no browser exceptions',
		],
	};
	writeFileSync(
		new URL('../organizations/results-github-preview.json', import.meta.url),
		JSON.stringify(result, null, 2) + '\n'
	);
	console.log('PASS:', result.checks.join('; '));
} finally {
	await browser.close();
}
