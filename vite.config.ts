import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import ViteRestart from 'vite-plugin-restart';
import tsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
	optimizeDeps: {
		exclude: [
			'tanstack-start-server-fn-manifest:v',
			'tanstack-start-router-manifest:v',
			'tanstack-start-server-routes-manifest:v',
		],
	},
	plugins: [
		tailwindcss(),
		ViteRestart({
			// Due to hydration issues, we need to restart the server on changes to the following files
			restart: ['./src/styles/**/*.css'],
		}),
		tsConfigPaths({
			projects: ['./tsconfig.json'],
		}),
		tanstackStart({
			tsr: {
				srcDirectory: 'src',
			},
			target: 'cloudflare-worker',
			customViteReactPlugin: true,
		}),
		viteReact(),
	],
});
