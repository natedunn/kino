import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(`${process.env.PROOF_PLAYWRIGHT}/index.mjs`).href);
const target = process.argv[2];
assert.ok(['native', 'production'].includes(target), 'Pass native or production.');

const config =
	target === 'native'
		? {
				origin: 'https://kino-native-auth-proof-c318c09d.hello-fc8.workers.dev',
				login: '/auth',
				output: '../performance/equivalent-dashboard-native.json',
			}
		: {
				origin: 'https://usekino.com',
				login: '/auth?redirect=%2Fdashboard',
				output: '../performance/equivalent-dashboard-production.json',
			};
const round = (value) => Math.round(value * 10) / 10;
const chromeExecutable =
	process.env.CHROME_EXECUTABLE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const productionProfile = '/tmp/kino-perf-proof/production-chrome-profile';
if (target === 'production') {
	mkdirSync(productionProfile, { recursive: true, mode: 0o700 });
	chmodSync(productionProfile, 0o700);
}
const browser = await chromium.launch({
	executablePath: chromeExecutable,
	headless: true,
});
const result = {
	recordedAt: new Date().toISOString(),
	target,
	origin: config.origin,
	conditions:
		'Same deployed /dashboard component; 10 fresh browser contexts with copied authenticated cookies; en-US Chrome, no throttling; backend and account data differ.',
	samples: [],
};

let loginContext;
try {
	loginContext =
		target === 'production'
			? await chromium.launchPersistentContext(productionProfile, {
					executablePath: chromeExecutable,
					headless: false,
					locale: 'en-US',
				})
			: await browser.newContext({ locale: 'en-US' });
	const loginPage = loginContext.pages()[0] ?? (await loginContext.newPage());
	if (target === 'native') {
		const password = readFileSync(
			new URL('../../../integrations/native-convex/.proof-password.local', import.meta.url),
			'utf8'
		).trim();
		await loginPage.goto(`${config.origin}${config.login}`);
		await loginPage.locator("input[type='email']").fill('hello@natedunn.net');
		await loginPage.locator("input[type='password']").fill(password);
		await loginPage.locator("button[type='submit']").click();
	} else {
		await loginPage.goto('https://github.com/login');
		console.log('Complete GitHub sign-in in this window. Kino OAuth will start automatically.');
		await loginPage.waitForURL(
			(url) => url.origin === 'https://github.com' && ['/', '/dashboard'].includes(url.pathname),
			{ timeout: 900_000 }
		);
		await loginPage.goto(`${config.origin}${config.login}`);
		if (new URL(loginPage.url()).pathname !== '/dashboard') {
			try {
				await loginPage.getByRole('button', { name: /continue with github/i }).click({
					timeout: 10_000,
				});
			} catch (error) {
				if (new URL(loginPage.url()).pathname !== '/dashboard') throw error;
			}
		}
		console.log('GitHub was already signed in; waiting for the Kino dashboard.');
	}
	const loginDeadline = Date.now() + 900_000;
	let dashboardPage;
	while (!dashboardPage && Date.now() < loginDeadline) {
		for (const page of loginContext.pages()) {
			if (page.isClosed()) continue;
			const url = new URL(page.url());
			if (url.origin === config.origin && url.pathname === '/dashboard') {
				dashboardPage = page;
				break;
			}
		}
		if (!dashboardPage) await new Promise((resolve) => setTimeout(resolve, 500));
	}
	assert.ok(dashboardPage, 'The test window did not reach the dashboard.');
	await dashboardPage.locator('main h1').waitFor();
	const cookies = await loginContext.cookies(config.origin);
	assert.ok(cookies.length > 0, 'No app cookies after login.');
	await loginContext.close();
	loginContext = undefined;

	for (let iteration = 0; iteration < 10; iteration += 1) {
		const context = await browser.newContext({ locale: 'en-US' });
		await context.addCookies(cookies);
		const page = await context.newPage();
		await page.addInitScript(() => {
			window.__kinoLcp = null;
			new PerformanceObserver((list) => {
				const entries = list.getEntries();
				window.__kinoLcp = entries.at(-1)?.startTime ?? null;
			}).observe({ type: 'largest-contentful-paint', buffered: true });
		});
		let browserHttpQueries = 0;
		let subscriptionAdds = 0;
		page.on('request', (request) => {
			if (new URL(request.url()).pathname === '/api/query') browserHttpQueries += 1;
		});
		page.on('websocket', (socket) => {
			socket.on('framesent', ({ payload }) => {
				try {
					const message = JSON.parse(payload.toString());
					subscriptionAdds += (message.modifications ?? []).filter(
						(change) => change.type === 'Add'
					).length;
				} catch {}
			});
		});
		const startedAt = performance.now();
		const response = await page.goto(`${config.origin}/dashboard`, {
			waitUntil: 'load',
			timeout: 60_000,
		});
		assert.equal(response.status(), 200);
		await page.locator('main h1').waitFor({ timeout: 30_000 });
		const visibleMs = round(performance.now() - startedAt);
		await page.waitForTimeout(500);
		const metrics = await page.evaluate(() => {
			const navigation = performance.getEntriesByType('navigation')[0];
			const fcp = performance.getEntriesByName('first-contentful-paint')[0];
			return {
				ttfbMs: navigation.responseStart,
				documentMs: navigation.responseEnd,
				fcpMs: fcp?.startTime ?? null,
				lcpMs: window.__kinoLcp,
			};
		});
		const html = await response.text();
		const heading = await page.locator('main h1').innerText();
		assert.equal(heading, 'Dashboard');
		assert.ok(html.includes('Your teams'), 'Dashboard teams missing from server HTML.');
		result.samples.push({
			iteration,
			visibleMs,
			browserHttpQueries,
			subscriptionAdds,
			...Object.fromEntries(
				Object.entries(metrics).map(([key, value]) => [
					key,
					typeof value === 'number' ? round(value) : value,
				])
			),
		});
		console.log(`${target} dashboard ${iteration + 1}/10: ${visibleMs}ms visible`);
		await context.close();
	}
} catch (error) {
	result.error = { name: error.name, message: error.message.slice(0, 200) };
	throw error;
} finally {
	writeFileSync(new URL(config.output, import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
	if (loginContext) await loginContext.close();
	await browser.close();
	if (target === 'production' && result.samples.length === 10)
		rmSync(productionProfile, { recursive: true, force: true });
}
