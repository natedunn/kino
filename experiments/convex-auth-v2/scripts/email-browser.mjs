// PROOF_PLAYWRIGHT points to an installed playwright package directory.
// Local credentials/browser state are ignored; tokens are never printed.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

const { chromium } = await import(pathToFileURL(`${process.env.PROOF_PLAYWRIGHT}/index.mjs`).href);
const root = fileURLToPath(new URL('../email/', import.meta.url));
const credentialsFile = `${root}.env.browser.json`;
const credentials = existsSync(credentialsFile)
	? JSON.parse(readFileSync(credentialsFile, 'utf8'))
	: { email: 'hello@natedunn.net', password: randomBytes(24).toString('base64url') };
credentials.newPassword ??= randomBytes(24).toString('base64url');
const save = (path, data) => writeFileSync(path, JSON.stringify(data), { mode: 0o600 });
save(credentialsFile, credentials);
const phase = process.argv[2] || 'signup';
assert.ok(['signup', 'verify', 'reset'].includes(phase));
const browser = await chromium.launch({ headless: true });
const client = new ConvexHttpClient('http://127.0.0.1:4420');
const mutate = (name, args) => client.mutation(makeFunctionReference(`auth:${name}`), args);
try {
	const page = await browser.newPage();
	const errors = [];
	page.on('pageerror', (error) => errors.push(error.name));
	const link =
		phase === 'signup'
			? 'http://127.0.0.1:5180/'
			: readFileSync(`${root}.env.link.local`, 'utf8').trim();
	assert.equal(new URL(link).origin, 'http://127.0.0.1:5180');
	await page.goto(link);
	await page.locator('#email').fill(credentials.email);
	await page
		.locator('#password')
		.fill(phase === 'reset' ? credentials.newPassword : credentials.password);
	if (phase === 'signup') {
		await page.getByRole('button', { name: 'Sign up', exact: true }).click();
		await page.waitForFunction(() =>
			document.querySelector('#status')?.textContent?.includes('accepted')
		);
		console.log('PASS: browser signup accepted. Scheduled verification delivery.');
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();
		await page.waitForFunction(() => document.querySelector('#status')?.textContent === 'error');
		assert.equal(await page.evaluate(() => sessionStorage.getItem('proof-session')), null);
		console.log('PASS: unverified browser sign-in rejected; no session stored.');
	} else if (phase === 'verify') {
		await page.getByRole('button', { name: 'Confirm email verification', exact: true }).click();
		await page.waitForFunction(() =>
			document.querySelector('#status')?.textContent?.startsWith('Signed in:')
		);
		const first = JSON.parse(await page.evaluate(() => sessionStorage.getItem('proof-session')));
		await page.reload();
		await page.waitForFunction(() =>
			document.querySelector('#status')?.textContent?.startsWith('Signed in:')
		);
		const rotated = JSON.parse(await page.evaluate(() => sessionStorage.getItem('proof-session')));
		const second = await mutate('signIn', {
			email: credentials.email,
			password: credentials.password,
		});
		assert.equal(second.status, 'complete');
		assert.equal(second.tokens.userId, first.userId);
		save(`${root}.env.sessions.json`, [first, rotated, second.tokens]);
		console.log(
			'PASS: inbox link verified account; authenticated query succeeds; reload retains identity; second session created.'
		);
		await page.getByRole('button', { name: 'Request reset email', exact: true }).click();
		await page.waitForFunction(() =>
			document.querySelector('#status')?.textContent?.includes('accepted')
		);
		console.log('PASS: browser requested reset email.');
	} else {
		await page.getByRole('button', { name: 'Set new password', exact: true }).click();
		await page.waitForFunction(() =>
			document.querySelector('#status')?.textContent?.includes('passwordUpdated')
		);
		const old = JSON.parse(readFileSync(`${root}.env.sessions.json`, 'utf8'));
		for (const session of old)
			assert.equal(
				(await mutate('refreshSession', { refreshToken: session.refreshToken })).kind,
				'noSession'
			);
		assert.equal(
			(await mutate('signIn', { email: credentials.email, password: credentials.password })).status,
			'error'
		);
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();
		await page.waitForFunction(() =>
			document.querySelector('#status')?.textContent?.startsWith('Signed in:')
		);
		const current = JSON.parse(await page.evaluate(() => sessionStorage.getItem('proof-session')));
		assert.equal(current.userId, old[0].userId);
		await page.reload();
		await page.waitForFunction(() =>
			document.querySelector('#status')?.textContent?.startsWith('Signed in:')
		);
		let replayRejected = false;
		try {
			await mutate('resetPassword', {
				code: new URLSearchParams(new URL(link).hash.slice(1)).get('reset'),
				password: credentials.newPassword,
			});
		} catch {
			replayRejected = true;
		}
		assert.ok(replayRejected);
		console.log(
			'PASS: reset consumed once; both old sessions and spent refresh token rejected; old password rejected; new password and reload preserve user ID.'
		);
	}
	assert.deepEqual(errors, []);
	console.log('PASS: no browser exceptions.');
} finally {
	await browser.close();
}
