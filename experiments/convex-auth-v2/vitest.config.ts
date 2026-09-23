import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
	// Match upstream's WASM module loading; do not replace password hashing.
	plugins: [
		{
			name: 'proof-wasm-module',
			enforce: 'pre',
			load(id) {
				if (!id.endsWith('.wasm')) return null;
				const base64 = readFileSync(id).toString('base64');
				return `export default new WebAssembly.Module(Uint8Array.from(atob(${JSON.stringify(base64)}), c => c.charCodeAt(0)));`;
			},
		},
	],
	resolve: {
		alias: {
			'@proof/auth-server': fileURLToPath(
				new URL('./.upstream/packages/core/src/server/index.ts', import.meta.url)
			),
		},
	},
	test: {
		include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
		environment: 'node',
		testTimeout: 15000,
		server: { deps: { inline: ['convex-test', 'argon2id-wasm'] } },
	},
});
