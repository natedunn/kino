import type { ReactNode } from 'react';

export function DocsPageHeader({
	title,
	description,
	meta,
}: {
	title: string;
	description: string;
	meta?: ReactNode;
}) {
	return (
		<header className='border-b border-border pb-8 md:-ml-8 md:pl-8'>
			<h1 className='text-3xl font-bold tracking-tight sm:text-4xl'>{title}</h1>
			<p className='mt-4 text-base leading-7 text-muted-foreground'>{description}</p>
			{meta ? <div className='mt-3 text-sm text-muted-foreground'>{meta}</div> : null}
		</header>
	);
}
