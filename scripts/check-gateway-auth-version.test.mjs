import assert from 'node:assert/strict';

import { test } from 'vitest';

import { checkGatewayAuthVersion } from './check-gateway-auth-version.mjs';

const origin = 'https://gateway.example.test';
const health = { ok: true, service: 'kino-gateway', betterAuthVersion: '1.7.1' };
const respond = (data) => async () => Response.json(data);

test('accepts a matching deployed version with an uncached health request', async () => {
	assert.equal(
		await checkGatewayAuthVersion(origin, '1.7.1', async (url, options) => {
			assert.equal(url.href, `${origin}/health`);
			assert.equal(options.cache, 'no-store');
			assert.equal(options.redirect, 'error');
			return Response.json(health);
		}),
		'1.7.1'
	);
});
for (const data of [
	{ ok: true, service: 'kino-gateway' },
	{ ...health, betterAuthVersion: '1.6.9' },
	{ ...health, ok: false },
	{ ...health, service: 'other' },
]) {
	test(`rejects incompatible health: ${JSON.stringify(data)}`, async () => {
		await assert.rejects(
			checkGatewayAuthVersion(origin, '1.7.1', respond(data)),
			/Deploy and verify the matching gateway first/
		);
	});
}
test('fails closed for HTTP and network errors or missing origin', async () => {
	await assert.rejects(
		checkGatewayAuthVersion(origin, '1.7.1', async () => new Response('', { status: 503 })),
		/HTTP 503/
	);
	await assert.rejects(
		checkGatewayAuthVersion(origin, '1.7.1', async () => {
			throw new Error('offline');
		}),
		/offline/
	);
	await assert.rejects(checkGatewayAuthVersion(''), /origin is required/);
});
