import type { Animate } from 'blobatar';

import * as React from 'react';
import { Blobatar } from '@blobatar/react';

import 'blobatar/motion.css';

import {
	getCurrentThemePreference,
	getServerThemePreference,
	subscribeThemePreference,
} from '@/lib/theme';
import { cn } from '@/lib/utils';

type AvatarContextValue = {
	fallbackAnimate?: Animate;
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

function Avatar({ className, fallbackAnimate = 'hover', fallbackName, ...props }: AvatarProps) {
	const [status, setStatus] = React.useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

	return (
		<AvatarContext.Provider value={{ fallbackAnimate, fallbackName, status, setStatus }}>
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
	const { fallbackAnimate, fallbackName, status } = useAvatarContext();
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

	return (
		<span
			data-slot='avatar-fallback'
			className={cn(
				fallbackName
					? 'block size-full rounded-full ring-1 ring-black/5 dark:ring-white/10'
					: 'flex size-full items-center justify-center rounded-full bg-primary text-xs',
				className
			)}
			{...props}
		>
			{fallbackName ? (
				<Blobatar
					animate={fallbackAnimate}
					background='circle'
					className='size-full'
					name={fallbackName}
					palette={blobatarOptions?.palette}
					tone={blobatarOptions?.tone}
				/>
			) : (
				props.children
			)}
		</span>
	);
}

export { Avatar, AvatarImage, AvatarFallback };
