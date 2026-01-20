import * as React from 'react';

import { cn } from '@/lib/utils';

type AvatarContextValue = {
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

function Avatar({ className, ...props }: React.ComponentProps<'span'>) {
	const [status, setStatus] = React.useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

	return (
		<AvatarContext.Provider value={{ status, setStatus }}>
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
	const { status } = useAvatarContext();
	const [canRender, setCanRender] = React.useState(delayMs === undefined);

	React.useEffect(() => {
		if (delayMs !== undefined) {
			const timer = setTimeout(() => setCanRender(true), delayMs);
			return () => clearTimeout(timer);
		}
	}, [delayMs]);

	if (status === 'loaded' || !canRender) {
		return null;
	}

	return (
		<span
			data-slot='avatar-fallback'
			className={cn(
				'flex size-full items-center justify-center rounded-full bg-primary text-xs',
				className
			)}
			{...props}
		/>
	);
}

export { Avatar, AvatarImage, AvatarFallback };
