import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(`${process.env.PROOF_PLAYWRIGHT}/index.mjs`).href);

const origin = 'https://kino-native-auth-proof-c318c09d.hello-fc8.workers.dev';
const slug = process.env.PROOF_FEEDBACK_SLUG;
assert.ok(slug, 'PROOF_FEEDBACK_SLUG is required');
const detailPath = `/@hello/native-feedback-proof/feedback/${slug}`;
const password = readFileSync(
	new URL('../../../integrations/native-convex/.proof-password.local', import.meta.url),
	'utf8'
).trim();
const comments = Array.from({ length: 24 }, (_, index) => `Pagination proof comment ${index}`);
const browser = await chromium.launch();
let page;

try {
	const context = await browser.newContext();
	page = await context.newPage();
	await page.goto(`${origin}/auth`, { waitUntil: 'load' });
	await page.locator("input[type='email']").fill('hello@natedunn.net');
	await page.locator("input[type='password']").fill(password);
	await page.locator("button[type='submit']").click();
	await page.waitForURL('**/dashboard');

	await page.goto(`${origin}${detailPath}`, { waitUntil: 'load' });
	const commentBox = page.locator('textarea');
	for (const comment of comments) {
		await commentBox.fill(comment);
		await page.getByRole('button', { name: /Post comment|Publicar comentario/i }).click();
		await assert.doesNotReject(() => commentBox.waitFor({ state: 'visible' }));
		await page.waitForFunction(() => document.querySelector('textarea')?.value === '');
	}

	await page.reload({ waitUntil: 'load' });
	const initialText = await page.locator('main').innerText();
	assert.ok(!initialText.includes(comments[0]), 'oldest comment must be paginated initially');
	for (const comment of comments.slice(4)) assert.ok(initialText.includes(comment));

	await page.getByRole('button', { name: /Show more comments|Mostrar más comentarios/i }).click();
	await page.waitForFunction(
		(firstComment) => document.querySelector('main')?.innerText.includes(firstComment),
		comments[0]
	);
	const completeText = await page.locator('main').innerText();
	let previousIndex = -1;
	for (const comment of comments) {
		const index = completeText.indexOf(comment);
		assert.ok(index > previousIndex, `${comment} must appear in chronological order`);
		previousIndex = index;
	}

	page.once('dialog', (dialog) => dialog.accept());
	await page
		.locator('aside button')
		.filter({ hasText: /Delete|Eliminar/i })
		.click();
	await page.waitForURL('**/feedback');
	console.log(
		`PASS ${slug}: newest 20 loaded first, older 4 merged chronologically, fixture deleted`
	);
} finally {
	await browser.close();
}
