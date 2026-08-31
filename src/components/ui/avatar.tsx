import type { Animate } from 'blobatar';

import * as React from 'react';
import { Blobatar } from '@blobatar/react';
import { palette as blobatarPalette, traits as blobatarTraits } from 'blobatar';

import 'blobatar/motion.css';

import {
	getCurrentThemePreference,
	getServerThemePreference,
	subscribeThemePreference,
} from '@/lib/theme';
import { cn } from '@/lib/utils';
import { getInitial } from '@/lib/utils/get-initial';

type AvatarContextValue = {
	fallbackAnimate?: Animate;
	fallbackKind?: 'blobatar' | 'org-initial';
	fallbackName?: string;
	status: 'idle' | 'loading' | 'loaded' | 'error';
	setStatus: (status: 'idle' | 'loading' | 'loaded' | 'error') => void;
};

const AvatarContext = React.createContext<AvatarContextValue | null>(null);

function useAvatarContext() {
	const context = React.useContext(AvatarContext);
	if (!context) {
		throw new Error('Avatar components must be used within an Avatar');
	}
	return context;
}

type AvatarProps = React.ComponentProps<'span'> & {
	fallbackAnimate?: Animate;
	fallbackKind?: 'blobatar' | 'org-initial';
	fallbackName?: string;
};

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
		// Keep dark-mode faces out of the inkiest tail so they stay legible on
		// the app's near-black surfaces while preserving deterministic variety.
		tone: 0.08 + seed * 0.8,
	};
}

function orgAvatarThemeOptions(name: string, isDark: boolean) {
	const seedTraits = blobatarTraits(name, true);
	// Keep org initials in a calmer mid-band while preserving deterministic hue.
	const tone = 0.18 + seedTraits('tone') * 0.45;
	const seededPalette = blobatarPalette(seedTraits.num('hue', 0, 360), true, tone);

	return {
		backgroundColor: seededPalette.head ?? '#6b7280',
		color: seededPalette.eye ?? '#ffffff',
		ringClassName: isDark ? 'ring-white/10' : 'ring-black/5',
	};
}

function Avatar({
	className,
	fallbackAnimate = 'hover',
	fallbackKind = 'blobatar',
	fallbackName,
	...props
}: AvatarProps) {
	const [status, setStatus] = React.useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

	return (
		<AvatarContext.Provider
			value={{ fallbackAnimate, fallbackKind, fallbackName, status, setStatus }}
		>
			<span
				data-slot='avatar'
				className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-full', className)}
				{...props}
			/>
		</AvatarContext.Provider>
	);
}

function AvatarImage({ className, src, alt, ...props }: React.ComponentProps<'img'>) {
	const { status, setStatus } = useAvatarContext();

	React.useEffect(() => {
		if (!src) {
			setStatus('error');
			return;
		}

		setStatus('loading');

		const image = new Image();
		image.src = src;
		image.onload = () => setStatus('loaded');
		image.onerror = () => setStatus('error');

		return () => {
			image.onload = null;
			image.onerror = null;
		};
	}, [src, setStatus]);

	if (status !== 'loaded') {
		return null;
	}

	return (
		<img
			data-slot='avatar-image'
			src={src}
			alt={alt}
			className={cn('aspect-square size-full', className)}
			{...props}
		/>
	);
}

function AvatarFallback({
	className,
	delayMs,
	...props
}: React.ComponentProps<'span'> & { delayMs?: number }) {
	const { fallbackAnimate, fallbackKind, fallbackName, status } = useAvatarContext();
	const [canRender, setCanRender] = React.useState(delayMs === undefined);
	const theme = React.useSyncExternalStore(
		subscribeThemePreference,
		getCurrentThemePreference,
		getServerThemePreference
	);

	React.useEffect(() => {
		if (delayMs !== undefined) {
			const timer = setTimeout(() => setCanRender(true), delayMs);
			return () => clearTimeout(timer);
		}
	}, [delayMs]);

	if (status === 'loaded' || !canRender) {
		return null;
	}

	const blobatarOptions = fallbackName
		? blobatarThemeOptions(fallbackName, theme === 'dark')
		: null;
	const orgFallbackStyles = fallbackName
		? orgAvatarThemeOptions(fallbackName, theme === 'dark')
		: null;
	const style =
		fallbackKind === 'org-initial' && orgFallbackStyles
			? ({
					backgroundColor: orgFallbackStyles.backgroundColor,
					color: orgFallbackStyles.color,
					containerType: 'size',
					...props.style,
				} satisfies React.CSSProperties)
			: props.style;

	return (
		<span
			data-slot='avatar-fallback'
			className={cn(
				fallbackName && fallbackKind === 'blobatar'
					? 'block size-full rounded-full ring-1 ring-black/5 dark:ring-white/10'
					: fallbackName && fallbackKind === 'org-initial'
						? cn(
								'flex size-full items-center justify-center rounded-full leading-none font-semibold ring-1',
								orgFallbackStyles?.ringClassName
							)
						: 'flex size-full items-center justify-center rounded-full bg-primary text-xs',
				className
			)}
			style={style}
			{...props}
		>
			{fallbackName && fallbackKind === 'blobatar' ? (
				<Blobatar
					animate={fallbackAnimate}
					background='circle'
					className='size-full'
					name={fallbackName}
					palette={blobatarOptions?.palette}
					tone={blobatarOptions?.tone}
				/>
			) : fallbackName && fallbackKind === 'org-initial' ? (
				<span className='text-[clamp(0.75rem,48cqh,1.75rem)] leading-none font-semibold'>
					{getInitial(fallbackName)}
				</span>
			) : (
				props.children
			)}
		</span>
	);
}

export { Avatar, AvatarImage, AvatarFallback };
