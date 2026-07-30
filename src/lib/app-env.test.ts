import { describe, expect, it } from 'vitest';

import { getAppInstallMetadata, inferAppEnvironment } from './app-env';

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

describe('getAppInstallMetadata', () => {
	it('uses blue production installation branding', () => {
		expect(getAppInstallMetadata('production')).toEqual({
			manifestHref: '/manifests/kino-production.json',
			appleTouchIconHref: '/pwa/production/apple-touch-icon-180.png',
			themeColor: '#0000FF',
			safariMaskColor: '#0000FF',
		});
	});

	it('uses yellow preview installation branding', () => {
		expect(getAppInstallMetadata('preview')).toEqual({
			manifestHref: '/manifests/kino-preview.json',
			appleTouchIconHref: '/pwa/preview/apple-touch-icon-180.png',
			themeColor: '#FACC15',
			safariMaskColor: '#FACC15',
		});
	});

	it('uses green local installation branding', () => {
		expect(getAppInstallMetadata('local')).toEqual({
			manifestHref: '/manifests/kino-local.json',
			appleTouchIconHref: '/pwa/local/apple-touch-icon-180.png',
			themeColor: '#22C55E',
			safariMaskColor: '#22C55E',
		});
	});
});
