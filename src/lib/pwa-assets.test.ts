import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import type { AppEnvironment } from './app-env';

const projectRoot = process.cwd();
const publicDirectory = path.join(projectRoot, 'public');
const execFileAsync = promisify(execFile);

const environments = {
	local: '#22C55E',
	preview: '#FACC15',
	production: '#0000FF',
} as const satisfies Record<AppEnvironment, string>;

type ManifestIcon = {
	src: string;
	sizes: string;
	type: string;
	purpose: string;
};

type AppManifest = {
	id: string;
	name: string;
	short_name: string;
	description: string;
	lang: string;
	dir: string;
	start_url: string;
	scope: string;
	display: string;
	orientation: string;
	prefer_related_applications: boolean;
	categories: Array<string>;
	theme_color: string;
	background_color: string;
	icons: Array<ManifestIcon>;
};

function publicAssetPath(urlPath: string) {
	return path.join(publicDirectory, urlPath.replace(/^\//, ''));
}

async function readManifest(environment: AppEnvironment) {
	const manifestPath = path.join(publicDirectory, 'manifests', `kino-${environment}.json`);
	const contents = await readFile(manifestPath, 'utf8');
	return JSON.parse(contents) as AppManifest;
}

async function readPngDimensions(filePath: string) {
	const contents = await readFile(filePath);
	const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

	expect(contents.subarray(0, pngSignature.length)).toEqual(pngSignature);

	return {
		width: contents.readUInt32BE(16),
		height: contents.readUInt32BE(20),
	};
}

async function inspectMaskableIcon(filePath: string, backgroundColor: string) {
	const script = `
		import sharp from 'sharp';

		const [filePath, backgroundColor] = process.argv.slice(1);
		const background = {
			red: Number.parseInt(backgroundColor.slice(1, 3), 16),
			green: Number.parseInt(backgroundColor.slice(3, 5), 16),
			blue: Number.parseInt(backgroundColor.slice(5, 7), 16),
		};
		const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({
			resolveWithObject: true,
		});
		const center = info.width / 2;
		let farthestMarkPixel = 0;
		let markPixelCount = 0;

		for (let y = 0; y < info.height; y += 1) {
			for (let x = 0; x < info.width; x += 1) {
				const offset = (y * info.width + x) * info.channels;
				const colorDistance =
					Math.abs(data[offset] - background.red) +
					Math.abs(data[offset + 1] - background.green) +
					Math.abs(data[offset + 2] - background.blue);

				if (colorDistance < 30) continue;

				markPixelCount += 1;
				farthestMarkPixel = Math.max(
					farthestMarkPixel,
					Math.hypot(x + 0.5 - center, y + 0.5 - center)
				);
			}
		}

		process.stdout.write(JSON.stringify({
			width: info.width,
			height: info.height,
			markPixelCount,
			farthestMarkPixel,
		}));
	`;
	const { stdout } = await execFileAsync(
		process.execPath,
		['--input-type=module', '--eval', script, filePath, backgroundColor],
		{ cwd: projectRoot }
	);

	return JSON.parse(stdout) as {
		width: number;
		height: number;
		markPixelCount: number;
		farthestMarkPixel: number;
	};
}

describe('PWA manifests and assets', () => {
	for (const environment of Object.keys(environments) as Array<AppEnvironment>) {
		const themeColor = environments[environment];

		it(`defines complete ${environment} installation metadata`, async () => {
			const manifest = await readManifest(environment);

			expect(manifest).toMatchObject({
				id: '/',
				name: 'Kino',
				short_name: 'Kino',
				lang: 'en',
				dir: 'ltr',
				start_url: '/',
				scope: '/',
				display: 'standalone',
				orientation: 'any',
				prefer_related_applications: false,
				theme_color: themeColor,
				background_color: '#FFFFFF',
			});
			expect(manifest.description.length).toBeGreaterThan(0);
			expect(manifest.categories).toEqual(['business', 'productivity']);
			expect(manifest.icons).toHaveLength(3);
			expect(manifest.icons).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ sizes: '192x192', purpose: 'any' }),
					expect.objectContaining({ sizes: '512x512', purpose: 'any' }),
					expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
				])
			);

			for (const icon of manifest.icons) {
				expect(icon.type).toBe('image/png');
				expect(icon.src.endsWith('.png')).toBe(true);

				const expectedSize = Number.parseInt(icon.sizes, 10);
				const dimensions = await readPngDimensions(publicAssetPath(icon.src));
				expect(dimensions).toEqual({ width: expectedSize, height: expectedSize });
			}

			const appleTouchIcon = path.join(
				publicDirectory,
				'pwa',
				environment,
				'apple-touch-icon-180.png'
			);
			const touchDimensions = await readPngDimensions(appleTouchIcon);
			expect(touchDimensions).toEqual({ width: 180, height: 180 });

			const sourceSvg = await readFile(
				path.join(publicDirectory, 'favicons', `kino-${environment}.svg`),
				'utf8'
			);
			expect(sourceSvg.toUpperCase()).toContain(`FILL="${themeColor}"`);
		});

		it(`keeps the ${environment} maskable mark inside the safe zone`, async () => {
			const maskableIcon = path.join(publicDirectory, 'pwa', environment, 'icon-maskable-512.png');
			const inspection = await inspectMaskableIcon(maskableIcon, themeColor);

			expect(inspection).toMatchObject({ width: 512, height: 512 });
			expect(inspection.markPixelCount).toBeGreaterThan(0);
			expect(inspection.farthestMarkPixel).toBeLessThanOrEqual(inspection.width * 0.4);
		});
	}
});
