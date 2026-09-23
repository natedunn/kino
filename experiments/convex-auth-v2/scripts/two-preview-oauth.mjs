import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

const { chromium } = await import(pathToFileURL(`${process.env.PROOF_PLAYWRIGHT}/index.mjs`).href);
const gateway =
	'https://kino-v2-gateway-proof-c318c09d.hello-fc8.workers.dev/oauth/github/callback';
const targets = [
	{
		name: 'alpha',
		origin: 'https://kino-auth-v2-proof-c318c09d.hello-fc8.workers.dev',
		backend: 'https://graceful-elephant-103.convex.cloud',
		folder: 'cloud',
	},
	{
		name: 'beta',
		origin: 'https://kino-auth-v2-proof-beta-c318c09d.hello-fc8.workers.dev',
		backend: 'https://cautious-oriole-896.convex.cloud',
		folder: 'cloud-beta',
	},
];
const deferred = () => {
	let resolve;
	const promise = new Promise((r) => (resolve = r));
	return { promise, resolve };
};
async function deadline(p) {
	let timer;
	try {
		return await Promise.race([
			p,
			new Promise(
				(_, reject) => (timer = setTimeout(() => reject(new Error('ConsentTimeout')), 600000))
			),
		]);
	} finally {
		clearTimeout(timer);
	}
}
const browser = await chromium.launch({ headless: false });
const reusePath = fileURLToPath(
	new URL('../cloud/.env.github-browser.local.json', import.meta.url)
);
const context = await browser.newContext(
	process.env.PROOF_REUSE_GITHUB === '1' ? { storageState: reusePath } : {}
);
const releaseGateway = deferred(),
	releaseApp = deferred();
const results = [];
const pass = (name) => {
	results.push(name);
	console.log('PASS:', name);
};
try {
	for (const t of targets) {
		t.gatewayReady = deferred();
		t.appReady = deferred();
		t.page = await context.newPage();
	}
	// CDP Fetch pauses every redirect hop. Playwright route() can skip redirected
	// requests, so it cannot implement this barrier for GitHub's automatic return.
	for (const t of targets) {
		const cdp = await context.newCDPSession(t.page);
		await cdp.send('Fetch.enable', {
			patterns: [
				{ urlPattern: gateway + '*', resourceType: 'Document', requestStage: 'Request' },
				{
					urlPattern: t.origin + '/api/auth/github/callback*',
					resourceType: 'Document',
					requestStage: 'Request',
				},
			],
		});
		cdp.on('Fetch.requestPaused', async (event) => {
			try {
				if (event.request.url.startsWith(gateway)) {
					t.gatewayUrl = event.request.url;
					t.gatewayReady.resolve();
					await releaseGateway.promise;
				} else {
					t.appUrl = event.request.url;
					t.appReady.resolve();
					await releaseApp.promise;
				}
				await cdp.send('Fetch.continueRequest', { requestId: event.requestId });
			} catch {
				/* Closing the browser cancels any outstanding interception. */
			}
		});
	}

	// Both backend states and both host-only browser cookies exist before either consent.
	await Promise.all(
		targets.map(async (t) => {
			await t.page.goto(t.origin);
			await t.page.locator('html[data-hydrated="true"]').waitFor();
			t.authorization = await t.page.evaluate(async () => {
				const r = await fetch('/api/auth/github/start', { method: 'POST' });
				if (!r.ok) throw new Error('StartFailed');
				return (await r.json()).redirect;
			});
			assert.equal(new URL(t.authorization).searchParams.get('redirect_uri'), gateway);
			assert.match(new URL(t.authorization).searchParams.get('state'), /^[A-Za-z0-9_-]{43}$/);
			assert.ok(Buffer.byteLength(t.authorization) <= 1024);
		})
	);
	pass('both previews initiate outstanding flows through the same callback URL');
	console.log(
		'READY: Complete GitHub sign-in in the visible alpha tab. The runner will open beta next; approve consent there if asked.'
	);
	await targets[0].page.bringToFront();
	void targets[0].page
		.goto(targets[0].authorization, { waitUntil: 'commit', timeout: 600000 })
		.catch(() => {});
	await deadline(targets[0].gatewayReady.promise);
	console.log(
		'READY: Alpha callback held. Completing beta before releasing both callbacks together.'
	);
	await targets[1].page.bringToFront();
	// GitHub may redirect immediately now that this browser is signed in. Do not wait
	// for navigation to finish: the gateway barrier deliberately pauses it.
	void targets[1].page
		.goto(targets[1].authorization, { waitUntil: 'commit', timeout: 600000 })
		.catch(() => {});
	await deadline(targets[1].gatewayReady.promise);
	releaseGateway.resolve();
	await deadline(Promise.all(targets.map((t) => t.appReady.promise)));
	pass('both real GitHub callbacks traverse the gateway concurrently to their own apps');
	for (let i = 0; i < 2; i++) {
		const t = targets[i],
			other = targets[1 - i];
		const wrong = new URL(other.appUrl);
		wrong.host = new URL(t.origin).host;
		const cookies = await context.cookies(t.origin);
		const cookie = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
		const r = await fetch(wrong, { headers: { Cookie: cookie }, redirect: 'manual' });
		assert.equal(r.status, 303);
		assert.ok(r.headers.get('location').includes('oauthError=invalid_flow'));
	}
	pass('unconsumed completion tickets cannot cross preview backends');
	releaseApp.resolve();
	await Promise.all(
		targets.map(async (t) => {
			await t.page.waitForURL(
				(url) => url.origin === t.origin && url.pathname === '/private/alpha' && !url.hash,
				{ timeout: 60000 }
			);
			await t.page.locator('html[data-hydrated="true"]').waitFor();
			await t.page.locator('#user').waitFor();
			t.user = await t.page.locator('#user').innerText();
			const cookies = (await context.cookies(t.origin)).filter((c) =>
				c.name.includes('convexAuth')
			);
			assert.equal(cookies.length, 2);
			assert.ok(
				cookies.every((c) => c.secure && c.httpOnly && c.domain === new URL(t.origin).hostname)
			);
			t.jwt = cookies.find((c) => c.name === '__convexAuthJWT').value;
			assert.equal(await t.page.evaluate(() => localStorage.length + sessionStorage.length), 0);
			const ssr = await context.request.get(t.origin + '/private/alpha');
			assert.ok((await ssr.text()).includes(t.user));
			await t.page.reload();
			await t.page.locator('#user').waitFor();
			assert.equal(await t.page.locator('#user').innerText(), t.user);
		})
	);
	assert.notEqual(targets[0].user, targets[1].user);
	for (const t of targets) {
		const folder = new URL('../' + t.folder + '/', import.meta.url);
		const env = parseEnv(readFileSync(new URL('.env.deploy.local', folder), 'utf8'));
		const rows = JSON.parse(
			execFileSync(
				process.execPath,
				[
					'../node_modules/convex/bin/main.js',
					'data',
					'accounts',
					'--component',
					'auth',
					'--format',
					'json',
				],
				{
					cwd: fileURLToPath(folder),
					env: { ...process.env, ...env },
					encoding: 'utf8',
					stdio: ['ignore', 'pipe', 'pipe'],
				}
			)
		);
		const account = rows.find((a) => a.userId === t.user);
		assert.equal(account.provider, 'github');
		t.githubId = account.providerAccountId;
	}
	assert.equal(targets[0].githubId, targets[1].githubId);
	pass(
		'same GitHub account maps to independent backend users, host-only cookies, private SSR and reload'
	);
	for (let i = 0; i < 2; i++) {
		const t = targets[i],
			other = targets[1 - i];
		const r = await fetch(other.backend + '/api/query', {
			method: 'POST',
			headers: { Authorization: `Bearer ${t.jwt}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ path: 'users:current', args: {}, format: 'json' }),
		});
		const j = await r.json();
		assert.ok(r.status === 401 || r.status === 403 || j.status === 'error' || j.value === null);
		assert.ok(!JSON.stringify(j).includes(other.user));
		const replay = await fetch(t.gatewayUrl, { redirect: 'manual' });
		assert.equal(replay.status, 400);
	}
	pass('cross-backend access JWTs and consumed gateway callbacks are rejected');
	const [a, b] = targets;
	const beforeB = await b.page.locator('#counter').innerText();
	const beforeA = Number(await a.page.locator('#counter').innerText());
	await a.page.getByRole('button', { name: 'Increment', exact: true }).click();
	await a.page.waitForFunction(
		(v) => document.querySelector('#counter')?.textContent === String(v),
		beforeA + 1
	);
	await b.page.reload();
	assert.equal(await b.page.locator('#counter').innerText(), beforeB);
	await a.page.getByRole('button', { name: 'Sign out', exact: true }).click();
	await a.page.waitForURL(a.origin + '/');
	await b.page.reload();
	assert.equal(await b.page.locator('#user').innerText(), b.user);
	pass('data mutations and logout in alpha leave beta data and session intact');
	await b.page.getByRole('button', { name: 'Sign out', exact: true }).click();
	await b.page.waitForURL(b.origin + '/');
	writeFileSync(
		new URL('../cloud/results-two-preview-oauth.json', import.meta.url),
		JSON.stringify(
			{
				recordedAt: new Date().toISOString(),
				environment:
					'two deployed Cloudflare apps and Convex previews, one gateway, actual GitHub OAuth; native callbacks synchronized with browser routing barriers',
				results,
			},
			null,
			2
		) + '\n'
	);
	console.log('SUCCESS: Both previews passed. Closing the proof browser.');
} catch (error) {
	console.log('FAILED:', error.name, '(credentials and callback URLs omitted)');
	process.exitCode = 1;
} finally {
	releaseGateway.resolve();
	releaseApp.resolve();
	await browser.close();
	if (process.env.PROOF_REUSE_GITHUB === '1') {
		try {
			unlinkSync(reusePath);
		} catch {}
	}
}
