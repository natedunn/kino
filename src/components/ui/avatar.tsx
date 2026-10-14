import type { Animate } from 'blobatar';

import * as React from 'react';
import { ClientOnly } from '@tanstack/react-router';

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

const BlobatarFallback = React.lazy(() =>
	import('./avatar-blobatar').then((module) => ({
		default: module.AvatarBlobatarFallback,
	}))
);

function stringHue(name: string) {
	let hash = 0;
	for (let index = 0; index < name.length; index += 1) {
		hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
	}
	return hash % 360;
}

function orgAvatarThemeOptions(name: string, isDark: boolean) {
	const hue = stringHue(name);
	return {
		backgroundColor: isDark ? `oklch(0.56 0.09 ${hue})` : `oklch(0.72 0.11 ${hue})`,
		color: isDark ? 'oklch(0.98 0.01 0)' : 'oklch(0.2 0.02 0)',
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

// The <img> ships in the SSR HTML so the browser fetches it (or reads its cache)
// before hydration, painting over the fallback the moment it decodes. It can
// finish before React attaches `onLoad`, so the mount effect checks it too.
function AvatarImage({
	className,
	src,
	alt,
	onError,
	onLoad,
	...props
}: React.ComponentProps<'img'>) {
	const { status, setStatus } = useAvatarContext();
	const imageRef = React.useRef<HTMLImageElement>(null);

	React.useEffect(() => {
		if (!src) {
			setStatus('error');
			return;
		}
		const image = imageRef.current;
		if (image?.complete) setStatus(image.naturalWidth > 0 ? 'loaded' : 'error');
		else setStatus('loading');
	}, [src, setStatus]);

	if (!src || status === 'error') {
		return null;
	}

	return (
		<img
			// Until it loads, the fallback is still mounted and is the accessible
			// alternative; don't let assistive tech announce both.
			aria-hidden={status === 'loaded' ? undefined : true}
			data-slot='avatar-image'
			ref={imageRef}
			src={src}
			alt={alt}
			className={cn('absolute inset-0 z-[1] aspect-square size-full', className)}
			onError={(event) => {
				setStatus('error');
				onError?.(event);
			}}
			onLoad={(event) => {
				setStatus('loaded');
				onLoad?.(event);
			}}
			{...props}
		/>
	);
}

function AvatarFallback({
	className,
	delayMs,
	style: styleProp,
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

	const orgFallbackStyles = fallbackName
		? orgAvatarThemeOptions(fallbackName, theme === 'dark')
		: null;
	const style =
		fallbackName && orgFallbackStyles
			? ({
					backgroundColor: orgFallbackStyles.backgroundColor,
					color: orgFallbackStyles.color,
					containerType: 'size',
					...styleProp,
				} satisfies React.CSSProperties)
			: styleProp;

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
				<ClientOnly
					fallback={
						<span className='text-[clamp(0.75rem,48cqh,1.75rem)] leading-none font-semibold'>
							{getInitial(fallbackName)}
						</span>
					}
				>
					<React.Suspense
						fallback={
							<span className='text-[clamp(0.75rem,48cqh,1.75rem)] leading-none font-semibold'>
								{getInitial(fallbackName)}
							</span>
						}
					>
						<BlobatarFallback
							animate={fallbackAnimate}
							className='size-full'
							name={fallbackName}
							theme={theme}
						/>
					</React.Suspense>
				</ClientOnly>
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
