// @ts-check
import { fileURLToPath } from 'node:url';

import createJiti from 'jiti';

const jiti = createJiti(fileURLToPath(import.meta.url));

jiti('./lib/env/server');
jiti('./lib/env/client');

/** @type {import('next').NextConfig} */
const nextConfig = {
	experimental: {
		reactCompiler: true,
	},
};

export default nextConfig;
