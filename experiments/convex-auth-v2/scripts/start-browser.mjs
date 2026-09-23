import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

const { chromium } = await import(pathToFileURL(`${process.env.PROOF_PLAYWRIGHT}/index.mjs`).href);
const credentials = JSON.parse(
	readFileSync(new URL('../email/.env.browser.json', import.meta.url), 'utf8')
);
const origin = process.env.PROOF_START_ORIGIN || 'http://127.0.0.1:5181';
assert.ok(
	['http://127.0.0.1:5181', 'http://127.0.0.1:5182', 'https://127.0.0.1:5183'].includes(origin)
);
const browser = await chromium.launch({ headless: true });
const results = [];
const pass = (name, details = {}) => {
	results.push({ name, ...details });
	console.log('PASS:', name, JSON.stringify(details));
};
try {
	const context = await browser.newContext({ ignoreHTTPSErrors: true });
	await context.addInitScript(() => {
		window.__proofPendingSeen = false;
		new MutationObserver(() => {
			if (document.querySelector('#pending')) window.__proofPendingSeen = true;
		}).observe(document, { childList: true, subtree: true });
	});
	const page = await context.newPage();
	const errors = [];
	const adds = [];
	const httpQueries = [];
	let refreshResponses = 0;
	page.on('response', (r) => {
		if (new URL(r.url()).pathname === '/api/auth/refresh' && r.status() === 200) refreshResponses++;
	});
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => {
		if (m.type() === 'error') errors.push(m.text());
	});
	page.on('request', (r) => {
		if (r.url().includes(':4420/api/query')) httpQueries.push(r.url());
	});
	page.on('websocket', (ws) =>
		ws.on('framesent', ({ payload }) => {
			try {
				const message = JSON.parse(payload.toString());
				for (const m of message.modifications || [])
					if (m.type === 'Add') adds.push({ path: m.udfPath, args: m.args });
			} catch {}
		})
	);
	await page.goto(origin);
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByLabel('Email').fill(credentials.email);
	await page.getByLabel('Password').fill(credentials.newPassword);
	const begin = performance.now();
	let refreshTokenExposed;
	await page.exposeFunction('proofSignInResponse', (value) => {
		refreshTokenExposed = value;
	});
	await page.evaluate(() => {
		const original = window.fetch.bind(window);
		window.fetch = async (...args) => {
			const response = await original(...args);
			if (String(args[0]).includes('/api/auth/signin')) {
				const data = await response.clone().json();
				await window.proofSignInResponse(JSON.stringify(data).includes('refreshToken'));
			}
			return response;
		};
	});
	const documentResponse = page.waitForResponse(
		(r) => r.request().isNavigationRequest() && r.url().includes('/private/alpha')
	);
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await page.waitForURL('**/private/alpha');
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.locator('#counter').waitFor();
	const signInMs = Math.round(performance.now() - begin);
	assert.equal(refreshTokenExposed, false);
	const cookies = await context.cookies();
	const authCookies = cookies.filter((c) => c.name.includes('convexAuth'));
	assert.equal(authCookies.length, 2);
	assert.ok(authCookies.every((c) => c.httpOnly));
	if (origin.startsWith('https:')) assert.ok(authCookies.every((c) => c.secure));
	assert.ok(!(await page.evaluate(() => document.cookie)).includes('convexAuth'));
	assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
	pass('HttpOnly cookie sign-in; no refresh token in JSON or browser storage', {
		signInToHydratedMs: signInMs,
	});
	const ssr = await documentResponse;
	const html = await ssr.text();
	const userId = await page.locator('#user').innerText();
	assert.ok(html.includes('id="counter"') && html.includes(userId));
	assert.equal(ssr.headers()['cache-control'], 'private, no-store');
	for (const cookie of authCookies)
		if (cookie.name.toLowerCase().includes('refresh')) assert.ok(!html.includes(cookie.value));
	assert.equal(httpQueries.length, 0);
	pass('Authenticated SSR contains private data; hydration makes no browser HTTP query');
	const jwt = authCookies.find((c) => c.name.includes('JWT'));
	assert.ok(jwt);
	const client = new ConvexHttpClient('http://127.0.0.1:4420');
	client.setAuth(jwt.value);
	const old = Number(await page.locator('#counter').innerText());
	const liveStart = performance.now();
	await client.mutation(makeFunctionReference('proof:increment'), { slug: 'alpha' });
	await page.waitForFunction(
		(value) => document.querySelector('#counter')?.textContent === String(value),
		old + 1
	);
	assert.equal(adds.filter((a) => JSON.stringify(a.args).includes('alpha')).length, 1);
	pass('External mutation updates hydrated subscription', {
		mutationToVisibleMs: Math.round(performance.now() - liveStart),
	});
	const betaBefore = adds.filter((a) => JSON.stringify(a.args).includes('beta')).length;
	assert.equal(betaBefore, 0);
	await page.getByRole('link', { name: 'Open beta' }).hover();
	await page.waitForTimeout(350);
	assert.equal(adds.filter((a) => JSON.stringify(a.args).includes('beta')).length, 1);
	assert.ok(page.url().endsWith('/private/alpha'));
	const navStart = performance.now();
	await page.getByRole('link', { name: 'Open beta' }).click();
	await page.waitForURL('**/private/beta');
	await page.getByRole('heading', { name: 'Private beta' }).waitFor();
	assert.equal(adds.filter((a) => JSON.stringify(a.args).includes('beta')).length, 1);
	assert.equal(await page.evaluate(() => window.__proofPendingSeen), false);
	pass('Hover starts beta subscription before navigation; click reuses it', {
		hoveredNavigationMs: Math.round(performance.now() - navStart),
	});
	const fresh = await context.request.get(`${origin}/private/alpha`);
	assert.equal(fresh.status(), 200);
	assert.ok((await fresh.text()).includes(userId));
	const anonymous = await browser.newContext({ ignoreHTTPSErrors: true });
	const anon = await anonymous.request.get(`${origin}/private/alpha`);
	assert.ok(!(await anon.text()).includes(userId));
	const forged = await anonymous.request.post(`${origin}/api/auth/refresh`, {
		headers: { Origin: 'https://attacker.test' },
		data: {},
	});
	assert.equal(forged.status(), 403);
	pass('Independent anonymous request receives no private data; cross-origin refresh refused');
	await anonymous.close();
	// Force SSR to use refresh cookie without waiting for the access JWT expiry.
	await context.clearCookies({ name: jwt.name });
	const refreshPage = await page.reload();
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.locator('#user').waitFor();
	assert.equal(await page.locator('#user').innerText(), userId);
	assert.equal(refreshPage.headers()['x-proof-ssr-refreshes'], '1');
	assert.ok((await context.cookies()).some((c) => c.name === jwt.name));
	pass('SSR refresh restores access cookie once for parallel token consumers');
	if (process.env.PROOF_ROLLOVER === '1') {
		const token = (await context.cookies()).find((c) => c.name === jwt.name).value;
		const expiry = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).exp * 1000;
		const refreshBefore = refreshResponses;
		while (Date.now() <= expiry + 1000)
			await page.waitForTimeout(Math.min(20000, expiry + 1100 - Date.now()));
		assert.ok(
			refreshResponses > refreshBefore,
			'Expected automatic cookie refresh before token expiry'
		);
		const before = Number(await page.locator('#counter').innerText());
		await page.getByRole('button', { name: 'Increment', exact: true }).click();
		await page.waitForFunction(
			(value) => document.querySelector('#counter')?.textContent === String(value),
			before + 1
		);
		pass(
			'Open page renews token through cookie endpoint and remains live past original JWT expiry'
		);
	}
	await page.getByRole('button', { name: 'Sign out', exact: true }).click();
	await page.waitForURL(origin + '/');
	assert.equal((await context.cookies()).filter((c) => c.name.includes('convexAuth')).length, 0);
	const loggedOut = await context.request.get(`${origin}/private/alpha`);
	assert.ok(!(await loggedOut.text()).includes(userId));
	pass('Sign-out clears cookies and private SSR access');
	assert.deepEqual(errors, []);
	pass('No browser or hydration errors');
	writeFileSync(
		new URL(
			origin.endsWith('5183')
				? '../start/results-cloudflare.json'
				: origin.endsWith('5182')
					? '../start/results-preview.json'
					: '../start/results.json',
			import.meta.url
		),
		JSON.stringify(
			{
				recordedAt: new Date().toISOString(),
				environment: origin.endsWith('5183')
					? 'local workerd HTTPS; self-signed certificate accepted by test browser'
					: origin.endsWith('5182')
						? 'local production build preview; not deployed latency'
						: 'local Vite dev; no production performance comparison',
				results,
			},
			null,
			2
		) + '\n'
	);
} finally {
	await browser.close();
}
