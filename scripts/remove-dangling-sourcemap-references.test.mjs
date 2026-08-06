import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { removeDanglingSourcemapReferences } from './remove-dangling-sourcemap-references.mjs';

test('removes only local source map references whose files are missing', async () => {
	const directory = await mkdtemp(path.join(tmpdir(), 'kino-sourcemaps-'));
	await mkdir(path.join(directory, 'assets'));
	await writeFile(path.join(directory, 'existing.js.map'), '{}');
	await writeFile(
		path.join(directory, 'existing.js'),
		'existing\n//# sourceMappingURL=existing.js.map\n'
	);
	await writeFile(
		path.join(directory, 'missing.js'),
		'missing\n//# sourceMappingURL=missing.js.map\n'
	);
	await writeFile(
		path.join(directory, 'assets', 'inline.js'),
		'inline\n//# sourceMappingURL=data:application/json;base64,e30=\n'
	);

	assert.equal(await removeDanglingSourcemapReferences(directory), 1);
	assert.match(await readFile(path.join(directory, 'existing.js'), 'utf8'), /sourceMappingURL/);
	assert.doesNotMatch(
		await readFile(path.join(directory, 'missing.js'), 'utf8'),
		/sourceMappingURL/
	);
	assert.match(
		await readFile(path.join(directory, 'assets', 'inline.js'), 'utf8'),
		/sourceMappingURL/
	);
});
