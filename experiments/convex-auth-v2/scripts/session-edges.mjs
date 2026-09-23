import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

import { ConvexHttpClient } from 'convex/browser';

const { chromium } = await import(pathToFileURL(`${process.env.PROOF_PLAYWRIGHT}/index.mjs`).href);
const cloud = process.env.PROOF_CLOUD === '1';
const origin = cloud
	? 'https://kino-auth-v2-proof-c318c09d.hello-fc8.workers.dev'
	: 'https://127.0.0.1:5183';
const backend = cloud ? 'https://graceful-elephant-103.convex.cloud' : 'http://127.0.0.1:4420';
const issuer = cloud ? 'https://graceful-elephant-103.convex.site' : 'http://127.0.0.1:4421';
const admin = new ConvexHttpClient(backend);
let rows;
if (cloud) {
	const deployment = JSON.parse(readFileSync(new URL('../cloud/deployment.json', import.meta.url)));
	assert.equal(deployment.type, 'preview');
	assert.equal(deployment.url, backend);
	const key = parseEnv(
		readFileSync(new URL('../cloud/.env.deploy.local', import.meta.url), 'utf8')
	).CONVEX_DEPLOY_KEY;
	assert.equal(key.split('|')[0].split(':').at(-1), deployment.name);
	admin.setAdminAuth(key);
	rows = await admin.function('fixtures:seed', undefined, {});
} else {
	const config = JSON.parse(
		readFileSync(new URL('../email/.convex/local/default/config.json', import.meta.url))
	);
	admin.setAdminAuth(config.adminKey);
	rows = JSON.parse(
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
				cwd: fileURLToPath(new URL('../email', import.meta.url)),
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'pipe'],
			}
		)
	);
}
console.log('Fixture accounts:', rows.length);

const [a, b] = rows;
assert.ok(a && b && a.userId !== b.userId);
const minted = [];
async function mint(account, refreshTtl = 300) {
	const tokens = await admin.function('public:signIn', 'auth', {
		claims: {
			providerName: account.provider,
			providerAccountId: account.providerAccountId,
			profile: {},
		},
		issuer,
		accessTokenTtlSeconds: Math.min(5, refreshTtl),
		refreshTokenTtlSeconds: refreshTtl,
	});
	minted.push(tokens.refreshToken);
	return tokens;
}
const browser = await chromium.launch();
const results = [];
async function test(name, fn) {
	try {
		await fn();
		results.push({ name, passed: true });
		console.log('PASS:', name);
	} catch (e) {
		results.push({
			name,
			passed: false,
			error:
				e instanceof assert.AssertionError
					? e.message.replace(/[A-Za-z0-9_-]{25,}/g, '[redacted]')
					: e.name,
		});
		console.log('FAIL:', name);
	}
}
const contexts = [];
async function session(account, ttl) {
	const c = await browser.newContext({ ignoreHTTPSErrors: !cloud });
	contexts.push(c);
	await install(c, await mint(account, ttl));
	return c;
}
async function install(c, t) {
	await c.addCookies([
		{
			name: '__convexAuthJWT',
			value: t.accessToken,
			url: origin,
			httpOnly: true,
			secure: true,
			sameSite: 'Lax',
		},
		{
			name: '__convexAuthRefreshToken',
			value: t.refreshToken,
			url: origin,
			httpOnly: true,
			secure: true,
			sameSite: 'Lax',
		},
	]);
}
async function open(c, suffix = '') {
	const p = await c.newPage();
	await p.goto(origin + '/private/alpha' + suffix);
	await p.locator('html[data-hydrated="true"]').waitFor();
	await p.locator('#user').waitFor();
	return p;
}
try {
	await test('simultaneous refresh requests preserve a usable cookie session', async () => {
		const c = await session(a);
		const replies = await Promise.all(
			Array.from({ length: 8 }, () =>
				c.request.post(origin + '/api/auth/refresh', { headers: { Origin: origin }, data: {} })
			)
		);
		assert.ok(replies.every((r) => r.status() === 200));
		const p = await open(c);
		assert.equal(await p.locator('#user').innerText(), a.userId);
		await c.close();
	});
	await test('logout in one tab removes private content in the other tab', async () => {
		const c = await session(a);
		const p = await open(c);
		const other = await open(c);
		await p.getByRole('button', { name: 'Sign out', exact: true }).click();
		await p.waitForURL(origin + '/');
		await other.waitForURL(origin + '/', { timeout: 10000 });
		assert.ok(!(await other.content()).includes(a.userId));
		await c.close();
	});
	await test('account switch clears old user and prefetched data in another tab', async () => {
		const c = await session(a);
		const old = await open(c);
		await old.getByRole('link', { name: 'Open beta' }).hover();
		await old.waitForTimeout(300);
		await install(c, await mint(b));
		const fresh = await open(c, '#session-changed');
		assert.equal(await fresh.locator('#user').innerText(), b.userId);
		await old.waitForFunction(
			(id) => document.querySelector('#user')?.textContent === id,
			b.userId,
			{ timeout: 10000 }
		);
		assert.ok(!(await old.content()).includes(a.userId));
		await old.getByRole('link', { name: 'Open beta' }).click();
		await old.waitForFunction(
			(id) => document.querySelector('#user')?.textContent === id,
			b.userId
		);
		assert.ok(!(await old.content()).includes(a.userId));
		await c.close();
	});
	await test('missed account-change notification is recovered on focus', async () => {
		const c = await session(a);
		const p = await open(c);
		await install(c, await mint(b));
		await p.evaluate(() => window.dispatchEvent(new Event('focus')));
		await p.waitForFunction((id) => document.querySelector('#user')?.textContent === id, b.userId, {
			timeout: 10000,
		});
		assert.ok(!(await p.content()).includes(a.userId));
		await c.close();
	});
	await test('refresh racing signout leaves the session unable to refresh', async () => {
		const t = await mint(a);
		const outcomes = await Promise.all([
			admin.function('public:refresh', 'auth', {
				refreshToken: t.refreshToken,
				issuer,
			}),
			admin.function('public:signOut', 'auth', { refreshToken: t.refreshToken }),
		]);
		const rotated = outcomes[0];
		const refreshToken = rotated.kind === 'rotated' ? rotated.tokens.refreshToken : t.refreshToken;
		const after = await admin.function('public:refresh', 'auth', {
			refreshToken,
			issuer,
		});
		assert.equal(after.kind, 'noSession');
	});
	console.log('Checking real expiry and frozen/offline recovery; waiting about one minute.');
	await Promise.all([
		test('expired refresh session clears cookies and denies private SSR', async () => {
			const c = await session(a, 60);
			await new Promise((r) => setTimeout(r, 61000));
			await c.clearCookies({ name: '__convexAuthJWT' });
			const r = await c.request.get(origin + '/private/alpha');
			assert.ok(!(await r.text()).includes(a.userId));
			assert.equal((await c.cookies()).filter((c) => c.name.includes('convexAuth')).length, 0);
			await c.close();
		}),
		test('offline tab resumes after actual current access-token expiry', async () => {
			const c = await session(a);
			const p = await open(c);
			await p.waitForTimeout(1000);
			await c.setOffline(true);
			const t = (await c.cookies()).find((c) => c.name === '__convexAuthJWT').value;
			const expiry = JSON.parse(Buffer.from(t.split('.')[1], 'base64url')).exp * 1000;
			await p.waitForTimeout(Math.max(0, expiry - Date.now() + 1500));
			await c.setOffline(false);
			await p.waitForTimeout(2000);
			const old = Number(await p.locator('#counter').innerText());
			await p.getByRole('button', { name: 'Increment', exact: true }).click();
			await p.waitForFunction(
				(v) => document.querySelector('#counter')?.textContent === String(v),
				old + 1,
				{ timeout: 15000 }
			);
			assert.equal(await p.locator('#user').innerText(), a.userId);
			await c.close();
		}),
		test('frozen tab resumes after token expiry and clears a missed logout', async () => {
			const c = await session(b);
			const p = await open(c);
			await p.waitForTimeout(1000);
			const cdp = await c.newCDPSession(p);
			await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
			await c.request.post(origin + '/api/auth/signout', { headers: { Origin: origin }, data: {} });
			await new Promise((r) => setTimeout(r, 62000));
			await cdp.send('Page.setWebLifecycleState', { state: 'active' });
			await p.evaluate(() => window.dispatchEvent(new Event('focus')));
			await p.waitForURL(origin + '/', { timeout: 15000 });
			assert.ok(!(await p.content()).includes(b.userId));
			await c.close();
		}),
	]);
} finally {
	for (const c of contexts) await c.close().catch(() => {});
	await browser.close();
	for (const refreshToken of minted)
		await admin.function('public:signOut', 'auth', { refreshToken });
	writeFileSync(
		new URL(
			cloud ? '../cloud/results-session-edges.json' : '../start/results-session-edges.json',
			import.meta.url
		),
		JSON.stringify(
			{
				recordedAt: new Date().toISOString(),
				environment: cloud
					? 'deployed Cloudflare and Convex preview; public TLS; admin-minted synthetic fixture sessions; no OAuth/email flow'
					: 'local HTTPS workerd, real local Convex, admin-minted fixture sessions; no OAuth/email flow',
				results,
			},
			null,
			2
		) + '\n'
	);
}
if (results.some((r) => !r.passed)) process.exitCode = 1;
