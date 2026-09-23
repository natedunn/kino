import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
execFileSync(process.execPath, ['scripts/upstream.mjs', '--check'], {
	cwd: root,
	stdio: 'inherit',
});
const target = `${root}/.revocation`;
// Only the generated, ignored proof copy is replaced. Never patch .upstream.
rmSync(target, { recursive: true, force: true });
mkdirSync(`${target}/packages/core`, { recursive: true });
cpSync(`${root}/.upstream/packages/core/src`, `${target}/packages/core/src`, { recursive: true });
// An independent repository prevents git apply from treating this as a subfolder
// of Kino and silently skipping paths outside the invocation prefix.
execFileSync('git', ['init', '--quiet'], { cwd: target, stdio: 'inherit' });
execFileSync('git', ['apply', `${root}/patches/session-revocation.patch`], {
	cwd: target,
	stdio: 'inherit',
});
execFileSync('git', ['apply', `${root}/patches/oauth-callback-url.patch`], {
	cwd: target,
	stdio: 'inherit',
});
console.log('Prepared isolated core with proposed revocation and callback URL patches.');
