import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(`${process.env.PROOF_PLAYWRIGHT}/index.mjs`).href);
const origin =
	process.env.PROOF_CLOUD === '1'
		? 'https://kino-auth-v2-proof-c318c09d.hello-fc8.workers.dev'
		: 'https://127.0.0.1:5183';
const gatewayCallback =
	process.env.PROOF_CLOUD === '1'
		? 'https://kino-v2-gateway-proof-c318c09d.hello-fc8.workers.dev/oauth/github/callback'
		: 'http://127.0.0.1:4411/oauth/github/callback';
const browser = await chromium.launch({ headless: false });
try {
	const context = await browser.newContext({ ignoreHTTPSErrors: process.env.PROOF_CLOUD !== '1' });
	const page = await context.newPage();
	await page.goto(origin);
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByRole('button', { name: 'Continue with GitHub', exact: true }).click();
	console.log('READY: Complete GitHub sign-in/consent in the opened Chromium window.');
	await page.waitForURL(origin + '/private/alpha', { timeout: 600000 });
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.locator('#user').waitFor();
	const user = await page.locator('#user').innerText();
	let cookies = (await context.cookies()).filter((c) => c.name.includes('convexAuth'));
	assert.equal(cookies.length, 2);
	assert.ok(cookies.every((c) => c.httpOnly && c.secure));
	assert.ok(!(await page.evaluate(() => document.cookie)).includes('convexAuth'));
	assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
	const ssr = await context.request.get(origin + '/private/alpha');
	assert.ok((await ssr.text()).includes(user));
	await page.reload();
	await page.locator('#user').waitFor();
	assert.equal(await page.locator('#user').innerText(), user);
	console.log(
		'PASS: real GitHub -> proof gateway -> Convex -> HTTPS Start cookie session; private SSR and reload retain identity.'
	);
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByRole('button', { name: 'Sign out', exact: true }).click();
	await page.waitForURL(origin + '/');
	assert.equal((await context.cookies()).filter((c) => c.name.includes('convexAuth')).length, 0);
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByRole('button', { name: 'Continue with GitHub', exact: true }).click();
	console.log(
		'READY: Repeat GitHub consent if GitHub requests it; the browser will verify the same identity.'
	);
	await page.waitForURL(origin + '/private/alpha', { timeout: 600000 });
	await page.locator('#user').waitFor();
	assert.equal(await page.locator('#user').innerText(), user);
	console.log('PASS: sign-out clears cookies; repeat GitHub login resolves the same app user.');
	writeFileSync(
		new URL(
			process.env.PROOF_CLOUD === '1'
				? '../cloud/results-github.json'
				: '../start/results-github.json',
			import.meta.url
		),
		JSON.stringify(
			{
				recordedAt: new Date().toISOString(),
				environment:
					process.env.PROOF_CLOUD === '1'
						? 'deployed Cloudflare + signed gateway routing + Convex preview + actual GitHub OAuth'
						: 'local HTTPS workerd + single-target gateway + actual GitHub OAuth',
				checks: [
					'Secure HttpOnly cookies',
					'no browser token storage',
					'private SSR',
					'reload retains identity',
					'logout clears cookies',
					'repeat login preserves user ID',
				],
			},
			null,
			2
		) + '\n'
	);
} finally {
	await browser.close();
}
