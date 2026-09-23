import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(`${process.env.PROOF_PLAYWRIGHT}/index.mjs`).href);
const origin = 'https://kino-native-auth-proof-c318c09d.hello-fc8.workers.dev';
const password = readFileSync(
	new URL('../../../integrations/native-convex/.proof-password.local', import.meta.url),
	'utf8'
).trim();
const browser = await chromium.launch({
	executablePath:
		process.env.CHROME_EXECUTABLE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const result = {
	recordedAt: new Date().toISOString(),
	target: origin,
	conditions:
		'Native proof dashboard in a fresh en-US Chrome context with untouched login cookies, first used after waiting beyond the 60-second access-token lifetime. No throttling.',
	samples: [],
};
const round = (value) => Math.round(value * 10) / 10;

async function sample(label, cookies) {
	const context = await browser.newContext({ locale: 'en-US' });
	await context.addCookies(cookies);
	const page = await context.newPage();
	let browserRefreshRequests = 0;
	page.on('request', (request) => {
		if (new URL(request.url()).pathname === '/api/auth/refresh') browserRefreshRequests += 1;
	});
	const response = await page.goto(`${origin}/dashboard`, {
		waitUntil: 'load',
		timeout: 60_000,
	});
	assert.equal(response.status(), 200);
	await page.locator('main h1').waitFor();
	assert.equal(await page.locator('main h1').innerText(), 'Dashboard');
	assert.ok((await response.text()).includes('Your teams'));
	const timings = await page.evaluate(() => {
		const navigation = performance.getEntriesByType('navigation')[0];
		const fcp = performance.getEntriesByName('first-contentful-paint')[0];
		return { ttfbMs: navigation.responseStart, fcpMs: fcp?.startTime ?? null };
	});
	const responseSetCookies = (await response.headerValues('set-cookie')).length;
	result.samples.push({
		label,
		browserRefreshRequests,
		responseSetCookies,
		...Object.fromEntries(
			Object.entries(timings).map(([key, value]) => [
				key,
				typeof value === 'number' ? round(value) : value,
			])
		),
	});
	await context.close();
}

try {
	const loginContext = await browser.newContext({ locale: 'en-US' });
	const page = await loginContext.newPage();
	await page.goto(`${origin}/auth`);
	await page.locator("input[type='email']").fill('hello@natedunn.net');
	await page.locator("input[type='password']").fill(password);
	await page.locator("button[type='submit']").click();
	await page.waitForURL(`${origin}/dashboard`);
	const cookies = await loginContext.cookies(origin);
	assert.ok(cookies.some((cookie) => cookie.name.includes('convexAuth')));
	await loginContext.close();
	console.log('Fresh login captured; waiting 75 seconds without reusing its refresh cookie.');
	await new Promise((resolve) => setTimeout(resolve, 75_000));
	await sample('expired_access', cookies);
	console.log('Expired-access dashboard SSR load passed.');
} finally {
	writeFileSync(
		new URL('../performance/expired-dashboard-results.json', import.meta.url),
		`${JSON.stringify(result, null, 2)}\n`
	);
	await browser.close();
}
