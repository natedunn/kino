import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(`${process.env.PROOF_PLAYWRIGHT}/index.mjs`).href);
const targets = [
	{
		name: 'production',
		url: 'https://usekino.com/@natedunn/kino/feedback',
	},
	{
		name: 'native',
		url: 'https://kino-native-auth-proof-c318c09d.hello-fc8.workers.dev/@storage-proof-0d90676a/native-storage-transport-proof/feedback',
	},
];
const round = (value) => Math.round(value * 10) / 10;
const result = {
	recordedAt: new Date().toISOString(),
	conditions:
		'Anonymous feedback-list route in fresh en-US Chrome contexts, no throttling. Production has one feedback item; native fixture is empty, so these are contextual public-SSR timings, not equal data workloads.',
	targets: Object.fromEntries(targets.map(({ name, url }) => [name, { url, samples: [] }])),
};
const browser = await chromium.launch({
	executablePath:
		process.env.CHROME_EXECUTABLE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});

try {
	for (let iteration = 0; iteration < 10; iteration += 1) {
		for (const target of iteration % 2 ? [...targets].reverse() : targets) {
			const context = await browser.newContext({ locale: 'en-US' });
			const page = await context.newPage();
			await page.addInitScript(() => {
				window.__kinoLcp = null;
				new PerformanceObserver((list) => {
					window.__kinoLcp = list.getEntries().at(-1)?.startTime ?? null;
				}).observe({ type: 'largest-contentful-paint', buffered: true });
			});
			const response = await page.goto(target.url, { waitUntil: 'load', timeout: 60_000 });
			assert.equal(response.status(), 200);
			await page.getByText('Feedback', { exact: true }).first().waitFor();
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
			assert.ok(html.includes('Feedback'), 'Feedback shell missing from SSR HTML.');
			result.targets[target.name].samples.push({
				iteration,
				...Object.fromEntries(
					Object.entries(metrics).map(([key, value]) => [
						key,
						typeof value === 'number' ? round(value) : value,
					])
				),
			});
			await context.close();
		}
	}
} finally {
	writeFileSync(
		new URL('../performance/public-feedback-results.json', import.meta.url),
		`${JSON.stringify(result, null, 2)}\n`
	);
	await browser.close();
}
