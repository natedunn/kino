import { readFileSync } from 'node:fs';
import type { GatewayEnv } from './env';

import { describe, expect, it } from 'vitest';

import worker from './index';

describe('gateway release identification', () => {
	it('reports the bundled auth version without credentials or cached health', async () => {
		const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
		const response = await worker.fetch(
			new Request('https://gateway.example.test/health'),
			{} as GatewayEnv,
			{} as ExecutionContext
		);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({
			ok: true,
			service: 'kino-gateway',
			betterAuthVersion: pkg.dependencies['better-auth'],
		});
	});
});
