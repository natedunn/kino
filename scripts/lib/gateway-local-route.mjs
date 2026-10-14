import { createHash, randomBytes } from 'node:crypto';

// `.env.local` keys owned by scripts/gateway-local-route.mjs.
export const MANAGED_ROUTE_KEYS = [
	'NATIVE_GITHUB_GATEWAY_URL',
	'NATIVE_GITHUB_ROUTE_ID',
	'NATIVE_GITHUB_ROUTE_SECRET',
	'VITE_NATIVE_GITHUB_ENABLED',
];

// Stable per worktree: the Portless app origin is unique to each checkout.
export function localRouteId(appOrigin) {
	return `local-${createHash('sha256').update(appOrigin).digest('hex').slice(0, 40)}`;
}

// A fresh key on every registration. The route is re-registered (PUT replaces
// it) on each `pnpm dev` before Vite reads `.env.local`, so nothing depends on
// the previous key, and a key copied in with another checkout's `.env.local`
// (`pnpm run setup` copies the main worktree's) is never reused.
export function newRouteSecret() {
	return randomBytes(32).toString('hex');
}

// Rewrites only the managed keys, preserving every other line.
export function rewriteManagedEnv(content, values) {
	const kept = content
		.split(/\r?\n/)
		.filter((line) => !MANAGED_ROUTE_KEYS.some((name) => line.startsWith(`${name}=`)));
	while (kept.length && kept.at(-1) === '') kept.pop();
	const managed = MANAGED_ROUTE_KEYS.filter((name) => values[name] !== undefined).map(
		(name) => `${name}=${values[name]}`
	);
	return `${[...kept, ...managed].join('\n')}\n`;
}
