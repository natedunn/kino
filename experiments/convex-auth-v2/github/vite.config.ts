import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

export default defineConfig({
	root: fileURLToPath(new URL('.', import.meta.url)),
	// Auth-provider proof only. This is not the eventual Start/SSR integration.
	define: { 'import.meta.env.VITE_CONVEX_URL': JSON.stringify('http://127.0.0.1:4410') },
	esbuild: { jsx: 'automatic' },
	resolve: { dedupe: ['react', 'react-dom', 'convex'] },
	server: {
		host: '127.0.0.1',
		port: 5179,
		strictPort: true,
		fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
	},
});
