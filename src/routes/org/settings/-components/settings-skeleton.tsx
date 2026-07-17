/**
 * Lightweight loading placeholder shown while an org's settings data loads
 * (e.g. when switching orgs). Mirrors the header + card rhythm of the settings
 * pages so the swap to real content doesn't jump.
 */
export function SettingsSkeleton() {
	return (
		<section className='max-w-3xl animate-pulse' aria-busy='true'>
			<span className='sr-only'>Loading…</span>
			{/* Header */}
			<div className='border-b pb-4'>
				<div className='h-6 w-40 rounded bg-muted' />
				<div className='mt-2 h-4 w-72 max-w-full rounded bg-muted/70' />
			</div>
			{/* Card body */}
			<div className='mt-6 space-y-4 rounded-xl border bg-card p-6'>
				<div className='h-4 w-24 rounded bg-muted' />
				<div className='h-10 w-full rounded-md bg-muted/70' />
				<div className='h-4 w-28 rounded bg-muted' />
				<div className='h-10 w-full rounded-md bg-muted/70' />
				<div className='h-4 w-20 rounded bg-muted' />
				<div className='h-10 w-2/3 rounded-md bg-muted/70' />
			</div>
		</section>
	);
}
