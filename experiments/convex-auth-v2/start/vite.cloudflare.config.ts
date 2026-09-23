import { readFileSync } from 'node:fs';

import { cloudflare } from '@cloudflare/vite-plugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		cloudflare({
			configPath:
				process.env.PROOF_CLOUD === '1'
					? process.env.PROOF_TARGET === 'beta'
						? 'wrangler.beta.jsonc'
						: 'wrangler.preview.jsonc'
					: 'wrangler.jsonc',
			viteEnvironment: { name: 'ssr' },
		}),
		tanstackStart(),
		react(),
	],
	server: {
		host: '127.0.0.1',
		port: 5183,
		strictPort: true,
		https: { key: readFileSync('.certs/key.pem'), cert: readFileSync('.certs/cert.pem') },
	},
	build: {
		outDir: process.env.PROOF_TARGET === 'beta' ? 'dist-cloudflare-beta' : 'dist-cloudflare',
	},
	resolve: {
		dedupe: ['react', 'react-dom', '@tanstack/react-query', '@tanstack/query-core', 'convex'],
	},
});
