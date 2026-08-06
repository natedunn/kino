import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceMapReference = /(?:\/\/[#@]|\/\*[#@])\s*sourceMappingURL=([^\s*]+)(?:\s*\*\/)?/g;

async function* walk(directory) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) yield* walk(entryPath);
		else if (entry.isFile() && /\.[cm]?js$/.test(entry.name)) yield entryPath;
	}
}

export async function removeDanglingSourcemapReferences(directory) {
	let removed = 0;

	for await (const filePath of walk(directory)) {
		const source = await readFile(filePath, 'utf8');
		const replacements = [];

		for (const match of source.matchAll(sourceMapReference)) {
			const reference = match[1];
			if (reference.startsWith('data:') || /^[a-z][a-z\d+.-]*:/i.test(reference)) continue;

			const mapPath = path.resolve(path.dirname(filePath), decodeURIComponent(reference));
			try {
				if ((await stat(mapPath)).isFile()) continue;
			} catch (error) {
				if (error?.code !== 'ENOENT') throw error;
			}

			replacements.push([match.index, match.index + match[0].length]);
		}

		if (replacements.length === 0) continue;

		let cleaned = source;
		for (const [start, end] of replacements.reverse()) {
			cleaned = cleaned.slice(0, start) + cleaned.slice(end);
		}
		await writeFile(filePath, cleaned);
		removed += replacements.length;
	}

	return removed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const directory = process.argv[2];
	if (!directory) throw new Error('Usage: remove-dangling-sourcemap-references.mjs <directory>');

	const removed = await removeDanglingSourcemapReferences(directory);
	console.log(`Removed ${removed} dangling source map reference${removed === 1 ? '' : 's'}.`);
}
