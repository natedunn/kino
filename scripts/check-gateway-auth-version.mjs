import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const expectedVersion = JSON.parse(
	readFileSync(new URL('../package.json', import.meta.url), 'utf8')
).dependencies['better-auth'];

export async function checkGatewayAuthVersion(origin, expected = expectedVersion, fetcher = fetch) {
	if (!origin) throw new Error('Gateway origin is required for the auth release check.');
	const response = await fetcher(new URL('/health', origin), {
		cache: 'no-store',
		redirect: 'error',
		signal: AbortSignal.timeout(10000),
	});
	if (!response.ok) throw new Error(`Gateway health check failed: HTTP ${response.status}`);
	const health = await response.json();
	if (
		health?.ok !== true ||
		health.service !== 'kino-gateway' ||
		health.betterAuthVersion !== expected
	) {
		throw new Error(
			`Gateway ${origin} reports Better Auth ${health?.betterAuthVersion ?? 'unknown'}; app requires ${expected}. ` +
				'Deploy and verify the matching gateway first. See docs/github-environments.md.'
		);
	}
	return health.betterAuthVersion;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const version = await checkGatewayAuthVersion(process.argv[2]);
		console.log(`Gateway auth version verified: ${version}`);
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
