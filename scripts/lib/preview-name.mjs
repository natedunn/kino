#!/usr/bin/env node

// The single implementation of preview naming. Names identify existing
// Cloudflare Worker Previews (40 chars) and Convex preview deployments
// (48 chars), so changing the output for an existing branch orphans its
// previews. `scripts/preview-name.sh` delegates here.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const CLOUDFLARE_PREVIEW_NAME_LENGTH = 40;
export const CONVEX_PREVIEW_NAME_LENGTH = 48;

export function previewName(branch, maxLength = CONVEX_PREVIEW_NAME_LENGTH) {
	const name = String(branch ?? '')
		// ASCII-only lowercasing; Unicode case mapping can produce ASCII letters
		// (e.g. the Kelvin sign) that the original `tr`-based script never did.
		.replace(/[A-Z]+/g, (letters) => letters.toLowerCase())
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-/, '')
		.slice(0, maxLength)
		// Trim after truncating so a cut at a separator cannot leave a trailing `-`.
		.replace(/-$/, '');
	return name || 'preview';
}

function parseMaxLength(value) {
	if (value === undefined || value === '') return CONVEX_PREVIEW_NAME_LENGTH;
	if (!/^[1-9][0-9]*$/.test(value)) {
		throw new Error(`Invalid preview name length '${value}'.`);
	}
	return Number(value);
}

const invokedPath = process.argv[1] ? realpathSync(process.argv[1]) : '';
if (invokedPath === realpathSync(fileURLToPath(import.meta.url))) {
	try {
		console.log(previewName(process.argv[2] ?? '', parseMaxLength(process.argv[3])));
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}
