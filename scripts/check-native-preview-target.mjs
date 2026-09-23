#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

// scripts/native-preview-deploy.sh publishes only the existing proof Worker.
const PROOF_WORKER_ORIGIN = 'https://kino-native-auth-proof-c318c09d.hello-fc8.workers.dev';
const PROOF_CONVEX_URL = 'https://giant-jaguar-319.convex.cloud';
const PROOF_KEY_PREFIX = 'dev:giant-jaguar-319|';

export function validateNativePreviewTarget(env, { allowBuildSelector = false } = {}) {
	const errors = [];
	const key = env.NATIVE_CONVEX_PREVIEW_DEPLOY_KEY;
	// This hosted proof is a preview deployment, but its deployment-scoped key
	// carries a dev: label. The Convex CLI targets the deployment named in it.
	if (!key?.startsWith(PROOF_KEY_PREFIX) || key.length <= PROOF_KEY_PREFIX.length) {
		errors.push('NATIVE_CONVEX_PREVIEW_DEPLOY_KEY must target giant-jaguar-319.');
	}
	if (env.CONVEX_DEPLOY_KEY && env.CONVEX_DEPLOY_KEY !== key) {
		errors.push('CONVEX_DEPLOY_KEY conflicts with the native preview key.');
	}
	if (env.CONVEX_DEPLOYMENT) {
		if (!allowBuildSelector || env.CONVEX_DEPLOYMENT !== 'preview:giant-jaguar-319') {
			errors.push('Remove local Convex deployment selectors before deployment.');
		}
	}
	if (env.CONVEX_SELF_HOSTED_URL || env.CONVEX_SELF_HOSTED_ADMIN_KEY) {
		errors.push('Remove self-hosted Convex deployment selectors.');
	}
	let expected;
	let actual;
	try {
		expected = new URL(env.NATIVE_CONVEX_PREVIEW_URL);
		if (
			expected.protocol !== 'https:' ||
			!expected.hostname.endsWith('.convex.cloud') ||
			expected.pathname !== '/' ||
			expected.username ||
			expected.password ||
			expected.port ||
			expected.search ||
			expected.hash
		) {
			throw new Error();
		}
	} catch {
		errors.push(
			'NATIVE_CONVEX_PREVIEW_URL must be the exact native https://<deployment>.convex.cloud URL.'
		);
	}
	if (env.NATIVE_CONVEX_PREVIEW_URL !== PROOF_CONVEX_URL) {
		errors.push(
			`NATIVE_CONVEX_PREVIEW_URL must target the isolated native deployment: ${PROOF_CONVEX_URL}.`
		);
	}
	if (env.VITE_CONVEX_URL) {
		try {
			actual = new URL(env.VITE_CONVEX_URL);
			if (actual.href !== expected?.href)
				errors.push('Convex CLI target differs from NATIVE_CONVEX_PREVIEW_URL.');
		} catch {
			errors.push('VITE_CONVEX_URL is invalid.');
		}
	}
	if (env.VITE_CONVEX_SITE_URL && expected) {
		const site = expected.href.replace(/\.convex\.cloud\/$/, '.convex.site/');
		if (env.VITE_CONVEX_SITE_URL !== site.replace(/\/$/, '')) {
			errors.push('VITE_CONVEX_SITE_URL differs from the native preview site.');
		}
	}
	try {
		const origin = new URL(env.NATIVE_APP_PREVIEW_ORIGIN);
		if (origin.protocol !== 'https:' || origin.origin !== env.NATIVE_APP_PREVIEW_ORIGIN)
			throw new Error();
	} catch {
		errors.push('NATIVE_APP_PREVIEW_ORIGIN must be an exact HTTPS origin.');
	}
	if (env.NATIVE_APP_PREVIEW_ORIGIN !== PROOF_WORKER_ORIGIN) {
		errors.push(
			`NATIVE_APP_PREVIEW_ORIGIN must target the isolated proof Worker: ${PROOF_WORKER_ORIGIN}.`
		);
	}
	if (env.VITE_SITE_URL && env.VITE_SITE_URL !== env.NATIVE_APP_PREVIEW_ORIGIN) {
		errors.push('VITE_SITE_URL differs from NATIVE_APP_PREVIEW_ORIGIN.');
	}
	if (env.VITE_NATIVE_GITHUB_ENABLED === 'true') {
		for (const name of [
			'NATIVE_GITHUB_GATEWAY_URL',
			'NATIVE_GITHUB_ROUTE_ID',
			'NATIVE_GITHUB_ROUTE_SECRET',
		]) {
			if (!env[name]) errors.push(`${name} is required when native GitHub is enabled.`);
		}
		try {
			const gateway = new URL(env.NATIVE_GITHUB_GATEWAY_URL);
			if (
				gateway.protocol !== 'https:' ||
				gateway.pathname !== '/oauth/github/callback' ||
				gateway.username ||
				gateway.password ||
				gateway.search ||
				gateway.hash
			)
				throw new Error();
		} catch {
			errors.push('NATIVE_GITHUB_GATEWAY_URL must be an HTTPS /oauth/github/callback URL.');
		}
	}
	return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const errors = validateNativePreviewTarget(process.env, {
		allowBuildSelector: process.argv.includes('--allow-build-selector'),
	});
	if (errors.length) {
		for (const error of errors) console.error(`Native preview target: ${error}`);
		process.exitCode = 1;
	} else {
		console.log(`target: isolated native preview (giant-jaguar-319, ${PROOF_CONVEX_URL})`);
	}
}
