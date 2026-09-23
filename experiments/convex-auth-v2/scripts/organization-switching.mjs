import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference as ref } from 'convex/server';

const cloud = process.env.PROOF_CLOUD === '1';
const origin = cloud
	? 'https://kino-auth-v2-proof-c318c09d.hello-fc8.workers.dev'
	: 'http://127.0.0.1:5181';
const backend = cloud ? 'https://graceful-elephant-103.convex.cloud' : 'http://127.0.0.1:4420';
const admin = new ConvexHttpClient(backend);
let adminKey, credentials;
if (cloud) {
	const deployment = JSON.parse(
		readFileSync(new URL('../cloud/deployment.json', import.meta.url), 'utf8')
	);
	assert.equal(deployment.type, 'preview');
	assert.equal(deployment.url, backend);
	adminKey = parseEnv(
		readFileSync(new URL('../cloud/.env.deploy.local', import.meta.url), 'utf8')
	).CONVEX_DEPLOY_KEY;
	assert.equal(adminKey.split('|')[0].split(':').at(-1), deployment.name);
} else {
	const local = JSON.parse(
		readFileSync(new URL('../email/.convex/local/default/config.json', import.meta.url), 'utf8')
	);
	assert.equal(local.ports.cloud, 4420);
	adminKey = local.adminKey;
	credentials = JSON.parse(
		readFileSync(new URL('../email/.env.browser.json', import.meta.url), 'utf8')
	);
}
admin.setAdminAuth(adminKey);
const { chromium } = await import(pathToFileURL(`${process.env.PROOF_PLAYWRIGHT}/index.mjs`).href);
const browser = await chromium.launch({ headless: true });
try {
	const context = await browser.newContext();
	const page = await context.newPage();
	const errors = [];
	const adds = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('websocket', (ws) =>
		ws.on('framesent', ({ payload }) => {
			try {
				for (const entry of JSON.parse(payload.toString()).modifications ?? [])
					if (entry.type === 'Add') adds.push(entry);
			} catch {}
		})
	);
	if (cloud) {
		const [account] = await admin.function('fixtures:seed', undefined, {});
		const tokens = await admin.function('public:signIn', 'auth', {
			claims: {
				providerName: account.provider,
				providerAccountId: account.providerAccountId,
				profile: {},
			},
			issuer: 'https://graceful-elephant-103.convex.site',
			accessTokenTtlSeconds: 300,
			refreshTokenTtlSeconds: 600,
		});
		await context.addCookies([
			{
				name: '__convexAuthJWT',
				value: tokens.accessToken,
				url: origin,
				httpOnly: true,
				secure: true,
				sameSite: 'Lax',
			},
			{
				name: '__convexAuthRefreshToken',
				value: tokens.refreshToken,
				url: origin,
				httpOnly: true,
				secure: true,
				sameSite: 'Lax',
			},
		]);
	} else {
		await page.goto(origin);
		await page.locator('html[data-hydrated="true"]').waitFor();
		await page.getByLabel('Email', { exact: true }).fill(credentials.email);
		await page.getByLabel('Password', { exact: true }).fill(credentials.newPassword);
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();
		await page.waitForURL('**/private/alpha');
		await page.locator('#user').waitFor();
	}
	const token = (await context.cookies()).find((c) => c.name === '__convexAuthJWT').value;
	const recipient = new ConvexHttpClient(backend);
	recipient.setAuth(token);
	const user = await recipient.query(ref('users:current'), {});
	const fixture = await admin.mutation(ref('invitationFixtures:seedSwitching'), {
		userId: user.userId,
	});
	const [alpha, beta] = fixture.organizations;
	const owner = new ConvexHttpClient(backend);
	owner.setAdminAuth(adminKey, {
		subject: fixture.ownerId,
		issuer: 'proof-fixture',
		tokenIdentifier: `proof-fixture|${fixture.ownerId}`,
	});
	await page.goto(`${origin}/org/${alpha.organizationId}`);
	await page.getByTestId('workspace').waitFor();
	assert.equal(
		await page.getByTestId('workspace').getAttribute('data-organization-id'),
		alpha.organizationId
	);
	const betaAdds = () =>
		adds.filter(
			(a) =>
				a.udfPath === 'policy:viewOrganization' &&
				JSON.stringify(a.args).includes(beta.organizationId)
		).length;
	await page.locator('a[href="/org/' + beta.organizationId + '"]').hover();
	await page.waitForTimeout(700);
	assert.ok(betaAdds() > 0, 'hover starts beta subscription');
	const count = betaAdds();
	await page.locator('a[href="/org/' + beta.organizationId + '"]').click();
	await page.getByRole('heading', { name: beta.name, exact: true }).waitFor();
	assert.equal(betaAdds(), count, 'click reuses hover subscription');
	const second = await context.newPage();
	second.on('pageerror', (e) => errors.push(e.message));
	await second.goto(`${origin}/org/${beta.organizationId}`);
	await second.getByTestId('workspace').waitFor();
	await page.locator('a[href="/org/' + alpha.organizationId + '"]').click();
	await page.getByRole('heading', { name: alpha.name, exact: true }).waitFor();
	assert.equal(
		await second.getByTestId('workspace').getAttribute('data-organization-id'),
		beta.organizationId
	);
	await owner.mutation(ref('organizations:setRole'), {
		membershipId: beta.membershipId,
		role: 'moderator',
		projectIds: [beta.projectId],
	});
	await second.getByTestId('management').filter({ hasText: 'Read only' }).waitFor();
	assert.equal(await page.getByTestId('management').innerText(), 'Management allowed');
	await owner.mutation(ref('organizations:remove'), { membershipId: beta.membershipId });
	await second.getByTestId('denied').waitFor();
	await page.locator('a[href="/org/' + beta.organizationId + '"]').waitFor({ state: 'detached' });
	await page.evaluate(() => {
		window.__staleWorkspaceSeen = false;
		new MutationObserver(() => {
			if (document.querySelector('[data-testid="workspace"]')?.textContent.includes('Switch beta'))
				window.__staleWorkspaceSeen = true;
		}).observe(document, { subtree: true, childList: true, characterData: true });
	});
	await page.goBack();
	await page.getByTestId('denied').waitFor();
	assert.equal(
		await page.evaluate(() => window.__staleWorkspaceSeen),
		false,
		'back navigation does not flash revoked beta data'
	);
	const denied = await context.request.get(`${origin}/org/${beta.organizationId}`);
	const html = await denied.text();
	assert.ok(html.includes('Organization unavailable'));
	assert.ok(!html.includes(beta.name));
	await assert.rejects(
		recipient.mutation(ref('organizations:increment'), { projectId: beta.projectId }),
		/FORBIDDEN/
	);
	await recipient.mutation(ref('organizations:increment'), { projectId: alpha.projectId });
	await second.reload();
	await second.getByTestId('denied').waitFor();
	assert.deepEqual(errors, []);
	const checks = [
		cloud ? 'real preview session for synthetic fixture user' : 'verified password login',
		'organization-specific query keys',
		'hover subscription reused on switch',
		'tabs select organizations independently',
		'live role demotion in one organization leaves the other unchanged',
		'revocation removes data and navigation in both tabs',
		'back navigation has no observed stale-data flash',
		'revoked SSR and reload contain no beta data',
		'revoked writes denied while other organization writes succeed',
		'no browser exceptions',
	];
	writeFileSync(
		new URL(
			cloud
				? '../organizations/results-switching-preview.json'
				: '../organizations/results-switching.json',
			import.meta.url
		),
		JSON.stringify({ checkedAt: new Date().toISOString(), origin, checks }, null, 2) + '\n'
	);
	console.log('PASS:', checks.join('; '));
} finally {
	await browser.close();
}
