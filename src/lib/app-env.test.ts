import { describe, expect, it } from 'vitest';

import { inferAppEnvironment } from './app-env';

describe('inferAppEnvironment', () => {
	it('treats explicit dev mode as local', () => {
		expect(
			inferAppEnvironment({
				hostname: 'usekino.com',
				isDev: true,
			})
		).toBe('local');
	});

	it('treats localhost-style hosts as local', () => {
		expect(
			inferAppEnvironment({
				hostname: 'feature-branch.kino.localhost',
			})
		).toBe('local');
	});

	it('treats the production host as production', () => {
		expect(
			inferAppEnvironment({
				hostname: 'usekino.com',
			})
		).toBe('production');
	});

	it('treats non-local non-production hosts as preview', () => {
		expect(
			inferAppEnvironment({
				hostname: 'feature-kino.hello-fc8.workers.dev',
			})
		).toBe('preview');
	});
});
