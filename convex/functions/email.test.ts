// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sendEmail } from '../lib/bento';

const CREDS: Record<string, string> = {
	BENTO_PUBLISHABLE_KEY: 'pub_test',
	BENTO_SECRET_KEY: 'sec_test',
	BENTO_SITE_UUID: 'site_test',
	BENTO_FROM: 'mail@usekino.com',
};

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

describe('sendEmail (Bento SDK)', () => {
	const original: Record<string, string | undefined> = {};
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		for (const [key, value] of Object.entries(CREDS)) {
			original[key] = process.env[key];
			process.env[key] = value;
		}
		// The SDK calls global fetch under the hood, so stubbing it lets us assert
		// the exact request it builds without hitting the network.
		fetchMock = vi.fn(async () => jsonResponse({ results: 1 }));
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		for (const key of Object.keys(CREDS)) {
			if (original[key] === undefined) delete process.env[key];
			else process.env[key] = original[key];
		}
		vi.unstubAllGlobals();
	});

	it('posts the batch payload with transactional: true and the configured from', async () => {
		const count = await sendEmail({
			to: 'user@example.com',
			subject: 'Hi',
			html: '<p>Hi</p>',
		});

		expect(count).toBe(1);
		expect(fetchMock).toHaveBeenCalledTimes(1);

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toContain('/batch/emails');
		expect(init.method).toBe('POST');
		expect((init.headers as Record<string, string>).Authorization).toBe(
			`Basic ${btoa('pub_test:sec_test')}`
		);

		const body = JSON.parse(init.body as string);
		expect(body.emails).toEqual([
			{
				to: 'user@example.com',
				from: 'mail@usekino.com',
				subject: 'Hi',
				html_body: '<p>Hi</p>',
				transactional: true,
			},
		]);
	});

	it('fans out an array of recipients to one email object each', async () => {
		await sendEmail({
			to: ['a@example.com', 'b@example.com'],
			subject: 'S',
			html: '<p>S</p>',
		});

		const init = fetchMock.mock.calls[0][1] as RequestInit;
		const body = JSON.parse(init.body as string);
		expect(body.emails).toHaveLength(2);
		expect(body.emails.map((e: { to: string }) => e.to)).toEqual([
			'a@example.com',
			'b@example.com',
		]);
		expect(body.emails.every((e: { transactional: boolean }) => e.transactional)).toBe(true);
	});

	it('throws naming the missing credential', async () => {
		delete process.env.BENTO_SECRET_KEY;
		await expect(
			sendEmail({ to: 'user@example.com', subject: 'Hi', html: '<p>Hi</p>' })
		).rejects.toThrow(/BENTO_SECRET_KEY/);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('throws when Bento rejects the send (non-2xx)', async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({ error: 'Author not authorized to send on this account' }, 403)
		);
		await expect(
			sendEmail({ to: 'user@example.com', subject: 'Hi', html: '<p>Hi</p>' })
		).rejects.toThrow();
	});
});
