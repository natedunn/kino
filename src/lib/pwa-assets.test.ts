import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { AppEnvironment } from './app-env';

import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const publicDirectory = path.join(projectRoot, 'public');
const execFileAsync = promisify(execFile);

const manifestThemeColors = {
	local: '#22C55E',
	preview: '#FACC15',
	production: '#0000FF',
} as const satisfies Record<AppEnvironment, string>;
const installBlueStops = ['#2563EB', '#3B82F6'];
const iosDarkBackground = '#1C1C1E';

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

function relativeLuminance(hexColor: string) {
	const channels = [1, 3, 5].map(
		(offset) => Number.parseInt(hexColor.slice(offset, offset + 2), 16) / 255
	);
	const [red, green, blue] = channels.map((channel) =>
		channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
	);

	return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(firstColor: string, secondColor: string) {
	const luminances = [relativeLuminance(firstColor), relativeLuminance(secondColor)].sort(
		(first, second) => second - first
	);

	return (luminances[0] + 0.05) / (luminances[1] + 0.05);
}

async function inspectMaskableIcon(filePath: string) {
	const script = `
		import sharp from 'sharp';

		const [filePath] = process.argv.slice(1);
		const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({
			resolveWithObject: true,
		});
		const center = info.width / 2;
		const backgroundColors = new Set();
		let farthestMarkPixel = 0;
		let markPixelCount = 0;
		let minimumAlpha = 255;

		for (let y = 0; y < info.height; y += 1) {
			for (let x = 0; x < info.width; x += 1) {
				const offset = (y * info.width + x) * info.channels;
				const red = data[offset];
				const green = data[offset + 1];
				const blue = data[offset + 2];
				minimumAlpha = Math.min(minimumAlpha, data[offset + 3]);
				const isWhiteMark = Math.min(red, green, blue) >= 230;

				if (isWhiteMark) {
					markPixelCount += 1;
					farthestMarkPixel = Math.max(
						farthestMarkPixel,
						Math.hypot(x + 0.5 - center, y + 0.5 - center)
					);
				} else {
					backgroundColors.add(red + ',' + green + ',' + blue);
				}
			}
		}

		process.stdout.write(JSON.stringify({
			width: info.width,
			height: info.height,
			markPixelCount,
			farthestMarkPixel,
			backgroundColorCount: backgroundColors.size,
			minimumAlpha,
		}));
	`;
	const { stdout } = await execFileAsync(
		process.execPath,
		['--input-type=module', '--eval', script, filePath],
		{ cwd: projectRoot }
	);

	return JSON.parse(stdout) as {
		width: number;
		height: number;
		markPixelCount: number;
		farthestMarkPixel: number;
		backgroundColorCount: number;
		minimumAlpha: number;
	};
}

describe('PWA manifests and assets', () => {
	it('uses a blue gradient that remains contrasty under either iOS dark treatment', async () => {
		const sourceSvg = await readFile(path.join(publicDirectory, 'pwa', 'kino-install.svg'), 'utf8');

		expect(sourceSvg).toContain('<linearGradient');
		for (const blue of installBlueStops) {
			expect(sourceSvg).toContain(`stop-color="${blue}"`);
			expect(contrastRatio(blue, '#FFFFFF')).toBeGreaterThanOrEqual(3);
			expect(contrastRatio(blue, iosDarkBackground)).toBeGreaterThanOrEqual(3);
		}
	});

	for (const environment of Object.keys(manifestThemeColors) as Array<AppEnvironment>) {
		const themeColor = manifestThemeColors[environment];

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
		});

		it(`keeps the ${environment} maskable mark inside the safe zone`, async () => {
			const maskableIcon = path.join(publicDirectory, 'pwa', environment, 'icon-maskable-512.png');
			const inspection = await inspectMaskableIcon(maskableIcon);

			expect(inspection).toMatchObject({ width: 512, height: 512 });
			expect(inspection.minimumAlpha).toBe(255);
			expect(inspection.backgroundColorCount).toBeGreaterThan(16);
			expect(inspection.markPixelCount).toBeGreaterThan(0);
			expect(inspection.farthestMarkPixel).toBeLessThanOrEqual(inspection.width * 0.4);
		});
	}

	it('uses the same blue installed-app artwork in every environment', async () => {
		for (const assetName of [
			'apple-touch-icon-180.png',
			'icon-192.png',
			'icon-512.png',
			'icon-maskable-512.png',
		]) {
			const productionIcon = await readFile(
				path.join(publicDirectory, 'pwa', 'production', assetName)
			);

			for (const environment of ['local', 'preview'] satisfies Array<AppEnvironment>) {
				const environmentIcon = await readFile(
					path.join(publicDirectory, 'pwa', environment, assetName)
				);
				expect(environmentIcon).toEqual(productionIcon);
			}
		}
	});
});
