type RoutePendingProps = {
	variant?: 'page' | 'detail' | 'form' | 'sidebar';
};

export function RoutePending({ variant = 'page' }: RoutePendingProps) {
	if (variant === 'sidebar') {
		return (
			<div className='container py-8'>
				<div className='grid grid-cols-1 gap-8 md:grid-cols-12'>
					<div className='order-first space-y-4 md:order-last md:col-span-3'>
						<div className='h-10 w-full animate-pulse rounded bg-muted' />
						<div className='h-48 w-full animate-pulse rounded bg-muted' />
					</div>
					<div className='space-y-4 md:col-span-9'>
						<div className='h-28 w-full animate-pulse rounded-lg bg-muted' />
						<div className='h-12 w-full animate-pulse rounded bg-muted' />
						<div className='h-32 w-full animate-pulse rounded bg-muted' />
						<div className='h-32 w-full animate-pulse rounded bg-muted' />
					</div>
				</div>
			</div>
		);
	}

	if (variant === 'detail') {
		return (
			<div className='container py-8'>
				<div className='grid grid-cols-1 gap-8 md:grid-cols-12'>
					<div className='order-first space-y-6 border-l border-border/75 py-6 pl-8 md:order-last md:col-span-4'>
						<div className='h-10 w-full animate-pulse rounded bg-muted' />
						<div className='h-32 w-full animate-pulse rounded bg-muted' />
					</div>
					<div className='animate-pulse space-y-4 md:col-span-8'>
						<div className='h-8 w-32 rounded bg-muted' />
						<div className='h-10 w-3/4 rounded bg-muted' />
						<div className='h-5 w-1/3 rounded bg-muted' />
						<div className='mt-6 h-64 rounded-lg bg-muted' />
					</div>
				</div>
			</div>
		);
	}

	if (variant === 'form') {
		return (
			<div className='container py-10'>
				<div className='mx-auto max-w-2xl animate-pulse space-y-4'>
					<div className='h-10 w-56 rounded bg-muted' />
					<div className='h-12 w-full rounded bg-muted' />
					<div className='h-12 w-full rounded bg-muted' />
					<div className='h-64 w-full rounded bg-muted' />
				</div>
			</div>
		);
	}

	return (
		<div className='container py-10'>
			<div className='mx-auto max-w-240 animate-pulse px-4'>
				<div className='h-12 w-56 rounded bg-muted' />
				<div className='mt-8 h-32 w-full rounded bg-muted' />
				<div className='mt-6 h-32 w-full rounded bg-muted' />
			</div>
		</div>
	);
}
