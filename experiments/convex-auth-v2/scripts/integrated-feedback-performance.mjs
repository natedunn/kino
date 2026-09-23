import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(
	pathToFileURL(`${process.env.PROOF_PLAYWRIGHT}/index.mjs`).href
);

const origin = 'https://kino-native-auth-proof-c318c09d.hello-fc8.workers.dev';
const listPath = '/@hello/native-feedback-proof/feedback';
const detailPath = `${listPath}/7zu47t22`;
const title = 'Native feedback acceptance verified';
const password = readFileSync(
	new URL('../../../integrations/native-convex/.proof-password.local', import.meta.url),
	'utf8'
).trim();
const output = {
	recordedAt: new Date().toISOString(),
	target: origin,
	conditions:
		'Integrated native feedback slice; same machine/network; fresh browser context per sample; authenticated with copied HttpOnly proof cookies; no CPU/network throttling.',
	reloads: [],
	hover: [],
};
const round = (value) => Math.round(value * 10) / 10;
const browser = await chromium.launch();

try {
	const loginContext = await browser.newContext();
	const loginPage = await loginContext.newPage();
	await loginPage.goto(`${origin}/auth`, { waitUntil: 'load' });
	await loginPage.locator("input[type='email']").fill('hello@natedunn.net');
	await loginPage.locator("input[type='password']").fill(password);
	await loginPage.locator("button[type='submit']").click();
	await loginPage.waitForURL('**/dashboard');
	const cookies = await loginContext.cookies(origin);
	assert.ok(cookies.some((cookie) => cookie.name.includes('convexAuth')));
	await loginContext.close();

	for (let iteration = 0; iteration < 10; iteration++) {
		const context = await browser.newContext();
		await context.addCookies(cookies);
		const page = await context.newPage();
		let browserHttpQueries = 0;
		page.on('request', (request) => {
			if (new URL(request.url()).pathname === '/api/query') browserHttpQueries++;
		});
		const response = await page.goto(`${origin}${detailPath}`, { waitUntil: 'load' });
		await page.getByRole('button', { name: title }).waitFor();
		const html = await response.text();
		assert.ok(html.includes(title));
		const metrics = await page.evaluate(() => {
			const navigation = performance.getEntriesByType('navigation')[0];
			const fcp = performance.getEntriesByName('first-contentful-paint')[0];
			return {
				ttfbMs: navigation.responseStart,
				documentMs: navigation.responseEnd,
				domContentLoadedMs: navigation.domContentLoadedEventEnd,
				loadMs: navigation.loadEventEnd,
				fcpMs: fcp?.startTime ?? null,
			};
		});
		output.reloads.push({
			iteration,
			cache: 'fresh browser context',
			browserHttpQueries,
			...Object.fromEntries(
				Object.entries(metrics).map(([key, value]) => [
					key,
					typeof value === 'number' ? round(value) : value,
				])
			),
		});
		await context.close();
	}

	for (const dwellMs of [0, 100, 700]) {
		for (let iteration = 0; iteration < 5; iteration++) {
			const context = await browser.newContext();
			await context.addCookies(cookies);
			const page = await context.newPage();
			let browserHttpQueries = 0;
			let subscriptionAdds = 0;
			page.on('request', (request) => {
				if (new URL(request.url()).pathname === '/api/query') browserHttpQueries++;
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
			await page.goto(`${origin}${listPath}`, { waitUntil: 'load' });
			const link = page.getByRole('link', { name: title });
			await link.waitFor();
			const beforeHoverAdds = subscriptionAdds;
			await link.hover();
			if (dwellMs > 0) await page.waitForTimeout(dwellMs);
			const afterHoverAdds = subscriptionAdds;
			const clickStartedAt = performance.now();
			await link.click();
			await page.getByRole('button', { name: title }).waitFor();
			const clickToDetailMs = round(performance.now() - clickStartedAt);
			assert.equal(new URL(page.url()).pathname, detailPath);
			output.hover.push({
				dwellMs,
				iteration,
				clickToDetailMs,
				browserHttpQueries,
				subscriptionAddsBeforeHover: beforeHoverAdds,
				subscriptionAddsDuringHover: afterHoverAdds - beforeHoverAdds,
				subscriptionAddsThroughNavigation: subscriptionAdds - beforeHoverAdds,
			});
			await context.close();
		}
	}
} finally {
	await browser.close();
	writeFileSync(
		new URL('../performance/integrated-feedback-results.json', import.meta.url),
		`${JSON.stringify(output, null, 2)}\n`
	);
}

console.log(
	`Captured ${output.reloads.length} authenticated reloads and ${output.hover.length} hover navigations.`
);
