#!/usr/bin/env node
if (process.env.VITE_NATIVE_GITHUB_ENABLED === 'true') {
	try {
		const callback = new URL(process.env.NATIVE_GITHUB_GATEWAY_URL);
		const healthUrl = new URL('/health', callback);
		const response = await fetch(healthUrl, { signal: AbortSignal.timeout(10_000) });
		if (!response.ok) throw new Error(`health returned ${response.status}`);
		const health = await response.json();
		if (
			health?.nativeGithub?.protocol !== 'opaque-state-v1' ||
			health.nativeGithub.storage !== true ||
			health.nativeGithub.enabled !== true
		) {
			throw new Error('native opaque-state routing is not active');
		}
		console.log(`Native GitHub gateway ready: ${healthUrl.origin}`);
	} catch (error) {
		console.error(
			`Native preview gateway: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exitCode = 1;
	}
}
