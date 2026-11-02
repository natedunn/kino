import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(
	await readFile(path.join(root, 'config/convex-auth-upstream.json'), 'utf8')
);
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const pinned = packageJson.dependencies?.['@convex-dev/auth'];
assert.ok(
	/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(pinned ?? ''),
	'Could not read the exact pinned Convex Auth release from package.json'
);

const headers = {
	Accept: 'application/vnd.github+json',
	'User-Agent': 'kino-convex-auth-upstream-check',
	'X-GitHub-Api-Version': '2022-11-28',
};
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function github(pathname) {
	const response = await fetch(`https://api.github.com/repos/${config.repository}${pathname}`, {
		headers,
	});
	if (!response.ok) {
		throw new Error(`GitHub API ${response.status} for ${pathname}: ${await response.text()}`);
	}
	return response.json();
}

const latest = await github(`/commits/${encodeURIComponent(config.branch)}`);
if (latest.sha === config.reviewedUpstreamSha) {
	console.log(
		`Convex Auth ${config.branch} is unchanged at reviewed commit ${latest.sha}; Kino remains pinned to ${pinned}.`
	);
	process.exit(0);
}

const comparison = await github(`/compare/${config.reviewedUpstreamSha}...${latest.sha}`);
const changedFiles = comparison.files?.map((file) => file.filename) ?? [];
const patchTargets = new Set(config.patchTargets);
const overlapping = changedFiles.filter((file) => patchTargets.has(file));

console.error(`Convex Auth ${config.branch} advanced since Kino's last review.`);
console.error(`Pinned:   ${pinned}`);
console.error(`Reviewed: ${config.reviewedUpstreamSha}`);
console.error(`Latest:   ${latest.sha}`);
console.error(
	`Compare:  https://github.com/${config.repository}/compare/${config.reviewedUpstreamSha}...${latest.sha}`
);
console.error(
	overlapping.length > 0
		? `Patched source files changed:\n${overlapping.map((file) => `  - ${file}`).join('\n')}`
		: 'No patched source file changed, but the alpha update still requires compatibility review.'
);
console.error(
	'After review, record the reviewed head in config/convex-auth-upstream.json. Upgrades follow npm releases (docs/convex-auth-v2-maintenance.md).'
);
process.exit(1);
