import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The published alpha.2 package is older than this source, despite sharing its version.
const commit = '1d105a04d124785441ce655cef33b54103c7bc2e';
const directory = fileURLToPath(new URL('../.upstream', import.meta.url));
const git = (...args) =>
	execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trim();
if (!existsSync(directory)) {
	if (process.argv.includes('--check')) throw new Error('Run npm run setup:source first.');
	mkdirSync(directory);
	git('init', '--quiet');
	git('fetch', '--quiet', '--depth=1', 'https://github.com/get-convex/convex-auth.git', commit);
	git('checkout', '--quiet', '--detach', 'FETCH_HEAD');
}
if (git('rev-parse', 'HEAD') !== commit || git('status', '--porcelain')) {
	throw new Error('The upstream checkout must match the pinned commit with no changes.');
}
console.log(`Testing official convex-auth source ${commit}`);
