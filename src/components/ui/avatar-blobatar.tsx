import type { Animate } from 'blobatar';

import { Blobatar } from '@blobatar/react';
import { palette as blobatarPalette, traits as blobatarTraits } from 'blobatar';

import 'blobatar/motion.css';

function blobatarNumberSeed(name: string) {
	let hash = 0;
	for (let index = 0; index < name.length; index += 1) {
		hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
	}
	return hash / 0xffffffff;
}

function blobatarThemeOptions(name: string, isDark: boolean) {
	if (!isDark) {
		return {
			palette: { bg: '#f4f5f7' },
			tone: undefined,
		};
	}

	const seed = blobatarNumberSeed(name);
	return {
		palette: { bg: '#242428' },
		tone: 0.08 + seed * 0.8,
	};
}

export function AvatarBlobatarFallback({
	animate,
	className,
	name,
	theme,
}: {
	animate?: Animate;
	className?: string;
	name: string;
	theme: 'dark' | 'light';
}) {
	const options = blobatarThemeOptions(name, theme === 'dark');

	return (
		<Blobatar
			animate={animate}
			background='circle'
			className={className}
			name={name}
			palette={options.palette}
			tone={options.tone}
		/>
	);
}

export function getAvatarInitialTheme(name: string, isDark: boolean) {
	const seedTraits = blobatarTraits(name, true);
	const tone = 0.18 + seedTraits('tone') * 0.45;
	const seededPalette = blobatarPalette(seedTraits.num('hue', 0, 360), true, tone);

	return {
		backgroundColor: seededPalette.head ?? (isDark ? '#4b5563' : '#6b7280'),
		color: seededPalette.eye ?? '#ffffff',
		ringClassName: isDark ? 'ring-white/10' : 'ring-black/5',
	};
}
