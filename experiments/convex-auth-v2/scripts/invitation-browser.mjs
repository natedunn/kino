import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference as ref } from 'convex/server';

const { chromium } = await import(pathToFileURL(`${process.env.PROOF_PLAYWRIGHT}/index.mjs`).href);
const local = JSON.parse(
	readFileSync(new URL('../email/.convex/local/default/config.json', import.meta.url), 'utf8')
);
assert.equal(local.ports.cloud, 4420);
const credentials = JSON.parse(
	readFileSync(new URL('../email/.env.browser.json', import.meta.url), 'utf8')
);
const admin = new ConvexHttpClient('http://127.0.0.1:4420');
admin.setAdminAuth(local.adminKey);
let invitationId;
if (process.env.PROOF_REUSE_INVITATION === '1') {
	invitationId = JSON.parse(
		readFileSync(new URL('../organizations/live-invitation.json', import.meta.url), 'utf8')
	).invitationId;
} else {
	const fixture = await admin.mutation(ref('invitationFixtures:seed'), {});
	const owner = new ConvexHttpClient('http://127.0.0.1:4420');
	owner.setAdminAuth(local.adminKey, {
		subject: fixture.userId,
		issuer: 'proof-fixture',
		tokenIdentifier: `proof-fixture|${fixture.userId}`,
	});
	invitationId = await owner.mutation(ref('invitations:create'), {
		organizationId: fixture.organizationId,
		email: credentials.email,
		role: 'admin',
		projectIds: [],
	});
	writeFileSync(
		new URL('../organizations/live-invitation.json', import.meta.url),
		JSON.stringify({ invitationId }) + '\n'
	);
	let accepted = false;
	for (let i = 0; i < 30; i++) {
		const data = await admin.query(ref('invitationMail:payload'), { invitationId });
		if (data?.invitation.deliveryStatus === 'failed') throw new Error('Bento delivery failed');
		if (data?.invitation.deliveryStatus === 'accepted') {
			accepted = true;
			break;
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	assert.ok(accepted, 'Bento accepted invitation');
	console.log('PASS: Bento accepted invitation');
}
const browser = await chromium.launch({ headless: true });
try {
	const context = await browser.newContext();
	const page = await context.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto(`http://127.0.0.1:5181/auth/accept-invitation?invitationId=${invitationId}`);
	await page.getByRole('link', { name: 'Sign in to accept' }).click();
	await page.getByLabel('Email', { exact: true }).fill(credentials.email);
	await page.getByLabel('Password', { exact: true }).fill(credentials.newPassword);
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await page
		.getByRole('heading', { name: 'Native invitation live proof' })
		.waitFor({ timeout: 12000 })
		.catch(async (error) => {
			console.log(
				'Debug page:',
				new URL(page.url()).pathname,
				await page.locator('body').innerText()
			);
			throw error;
		});
	await page.getByRole('button', { name: 'Accept invitation', exact: true }).click();
	await page.getByRole('status').filter({ hasText: 'Invitation accepted' }).waitFor();
	await page.reload();
	await page.getByText('Status: accepted', { exact: true }).waitFor();
	await page.getByRole('link', { name: 'Open organizations' }).click();
	await page.getByRole('listitem').filter({ hasText: 'Native invitation live proof' }).waitFor();
	const response = await context.request.get('http://127.0.0.1:5181/organizations');
	assert.ok((await response.text()).includes('Native invitation live proof'));
	assert.deepEqual(errors, []);
	const checks = [
		'Bento accepted invitation',
		'anonymous invitation login',
		'password login preserves destination',
		'verified user accepts',
		'accepted state survives reload',
		'live organization query',
		'organization SSR',
		'no browser exceptions',
	];
	writeFileSync(
		new URL('../organizations/results-browser.json', import.meta.url),
		JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2) + '\n'
	);
	console.log('PASS:', checks.join('; '));
} finally {
	await browser.close();
}
