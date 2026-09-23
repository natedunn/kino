import assert from 'node:assert/strict';
import test from 'node:test';

import { validateNativePreviewTarget } from './check-native-preview-target.mjs';

const valid = {
	NATIVE_CONVEX_PREVIEW_DEPLOY_KEY: 'dev:giant-jaguar-319|redacted',
	NATIVE_CONVEX_PREVIEW_URL: 'https://giant-jaguar-319.convex.cloud',
	NATIVE_APP_PREVIEW_ORIGIN: 'https://kino-native-auth-proof-c318c09d.hello-fc8.workers.dev',
	VITE_CONVEX_URL: 'https://giant-jaguar-319.convex.cloud',
	VITE_CONVEX_SITE_URL: 'https://giant-jaguar-319.convex.site',
	VITE_SITE_URL: 'https://kino-native-auth-proof-c318c09d.hello-fc8.workers.dev',
};

test('accepts the known deployment-scoped key and matching native proof target', () => {
	assert.deepEqual(validateNativePreviewTarget(valid), []);
	assert.deepEqual(
		validateNativePreviewTarget(
			{ ...valid, CONVEX_DEPLOYMENT: 'preview:giant-jaguar-319' },
			{ allowBuildSelector: true }
		),
		[]
	);
});

test('rejects legacy, production, and mixed deployment targets', () => {
	assert.ok(
		validateNativePreviewTarget({
			...valid,
			NATIVE_CONVEX_PREVIEW_DEPLOY_KEY: 'prod:legacy|redacted',
		}).length
	);
	assert.ok(
		validateNativePreviewTarget({
			...valid,
			NATIVE_CONVEX_PREVIEW_DEPLOY_KEY: 'dev:other-deployment|redacted',
		}).length
	);
	assert.ok(
		validateNativePreviewTarget({
			...valid,
			NATIVE_CONVEX_PREVIEW_DEPLOY_KEY: 'preview:team:project|redacted',
		}).length
	);
	assert.ok(
		validateNativePreviewTarget({
			...valid,
			NATIVE_CONVEX_PREVIEW_URL: 'https://legacy.convex.cloud',
		}).length
	);
	assert.ok(
		validateNativePreviewTarget({ ...valid, VITE_CONVEX_URL: 'https://legacy.convex.cloud' }).length
	);
	assert.ok(validateNativePreviewTarget({ ...valid, CONVEX_DEPLOYMENT: 'dev:legacy' }).length);
	assert.ok(
		validateNativePreviewTarget({ ...valid, CONVEX_DEPLOYMENT: 'preview:giant-jaguar-319' }).length
	);
	assert.ok(
		validateNativePreviewTarget(
			{ ...valid, CONVEX_DEPLOYMENT: 'preview:other-deployment' },
			{ allowBuildSelector: true }
		).length
	);
	assert.ok(
		validateNativePreviewTarget({ ...valid, VITE_CONVEX_SITE_URL: 'https://legacy.convex.site' })
			.length
	);
	assert.ok(
		validateNativePreviewTarget({
			...valid,
			NATIVE_APP_PREVIEW_ORIGIN: 'https://usekino.com',
			VITE_SITE_URL: 'https://usekino.com',
		}).some((error) => error.includes('isolated proof Worker'))
	);
});

test('requires route configuration when native GitHub is enabled', () => {
	assert.ok(
		validateNativePreviewTarget({ ...valid, VITE_NATIVE_GITHUB_ENABLED: 'true' }).some((error) =>
			error.includes('NATIVE_GITHUB_ROUTE_ID')
		)
	);
	assert.ok(
		validateNativePreviewTarget({
			...valid,
			VITE_NATIVE_GITHUB_ENABLED: 'true',
			NATIVE_GITHUB_GATEWAY_URL: 'https://gateway-dev.usekino.com/',
		}).some((error) => error.includes('/oauth/github/callback'))
	);
});
