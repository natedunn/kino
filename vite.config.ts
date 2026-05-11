import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { analyzer } from 'vite-bundle-analyzer';
import ViteRestart from 'vite-plugin-restart';

export default defineConfig({
	server: {
		host: process.env.HOST ?? true,
		port: Number(process.env.PORT ?? 3000),
	},
	resolve: {
		tsconfigPaths: true,
	},
	ssr: {
		noExternal: ['@convex-dev/better-auth'],
	},
	plugins: [
		analyzer({
			enabled: process.env.ANALYZE === 'true',
		}),
		tailwindcss(),
		ViteRestart({
			// Due to hydration issues, we need to restart the server on changes to the following files
			restart: ['./src/styles/**/*.css'],
		}),
		cloudflare({ viteEnvironment: { name: 'ssr' } }),
		tanstackStart({
			srcDirectory: 'src',
		}),
		viteReact(),
	],
});
