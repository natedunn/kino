#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const name = process.argv[2];
if (!name || !/^[a-z0-9-]{1,40}$/.test(name)) {
	console.error('Usage: cleanup-cloudflare-preview.mjs <normalized-preview-name>');
	process.exit(1);
}

if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) {
	console.log('Skipping Cloudflare preview cleanup: missing account ID or API token.');
	process.exit(0);
}

const result = spawnSync(
	'pnpm',
	[
		'exec', 'wrangler', 'preview', 'delete',
		'--config', 'wrangler.jsonc',
		'--worker-name', process.env.CLOUDFLARE_WORKER_NAME ?? 'kino',
		'--name', name,
		'--skip-confirmation',
	],
	{ encoding: 'utf8' }
);
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
if (result.status === 0) {
	console.log(`Deleted Cloudflare Worker Preview '${name}'.`);
} else if (/not found|does not exist|404/i.test(output)) {
	console.log(`Cloudflare Worker Preview '${name}' is already absent.`);
} else {
	console.error(`Cloudflare Worker Preview cleanup failed for '${name}'.`);
	console.error(output.trim());
	process.exit(result.status ?? 1);
}
