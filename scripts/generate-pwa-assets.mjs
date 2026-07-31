import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const environments = ['local', 'preview', 'production'];
const source = path.join(projectRoot, 'public', 'pwa', 'kino-install.svg');
const assets = [
	{ fileName: 'apple-touch-icon-180.png', size: 180 },
	{ fileName: 'icon-192.png', size: 192 },
	{ fileName: 'icon-512.png', size: 512 },
	{ fileName: 'icon-maskable-512.png', size: 512 },
];

for (const environment of environments) {
	const outputDirectory = path.join(projectRoot, 'public', 'pwa', environment);

	await mkdir(outputDirectory, { recursive: true });

	for (const asset of assets) {
		await sharp(source, { density: 192 })
			.resize(asset.size, asset.size, { fit: 'fill' })
			.png({ compressionLevel: 9 })
			.toFile(path.join(outputDirectory, asset.fileName));
	}
}

console.log(`Generated ${environments.length * assets.length} PWA icon assets.`);
