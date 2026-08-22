import { HardDrive } from 'lucide-react';

type Breakdown = Record<string, { bytes: number; files: number }>;

export function StorageSummary({
	fileCount,
	limitBytes,
	reservedBytes,
	usedBytes,
}: {
	fileCount: number;
	limitBytes: number;
	reservedBytes: number;
	usedBytes: number;
}) {
	const committedPercent = Math.min(100, (usedBytes / Math.max(1, limitBytes)) * 100);
	const reservedPercent = Math.min(
		100 - committedPercent,
		(reservedBytes / Math.max(1, limitBytes)) * 100
	);
	return (
		<section className='overflow-hidden rounded-xl border bg-card'>
			<div className='flex items-start gap-4 p-6'>
				<span className='flex size-11 items-center justify-center rounded-xl border bg-muted/40'>
					<HardDrive className='size-5' />
				</span>
				<div>
					<h3 className='font-semibold'>Project storage</h3>
					<p className='mt-1 text-sm text-muted-foreground'>
						{formatBytes(usedBytes)} used of {formatBytes(limitBytes)} · {fileCount} file
						{fileCount === 1 ? '' : 's'}
					</p>
				</div>
			</div>
			<div className='border-t bg-muted/20 p-6'>
				<div className='flex h-3 overflow-hidden rounded-full bg-muted'>
					<div
						className='bg-primary transition-[width]'
						style={{ width: `${committedPercent}%` }}
					/>
					<div
						className='bg-primary/35 transition-[width]'
						style={{ width: `${reservedPercent}%` }}
					/>
				</div>
				<div className='mt-2 flex justify-between text-xs text-muted-foreground'>
					<span>{committedPercent.toFixed(committedPercent < 1 ? 1 : 0)}% used</span>
					<span>
						{reservedBytes
							? `${formatBytes(reservedBytes)} uploading`
							: `${formatBytes(Math.max(0, limitBytes - usedBytes))} available`}
					</span>
				</div>
			</div>
		</section>
	);
}

export function StorageBreakdown({ breakdown, title }: { breakdown: Breakdown; title: string }) {
	const entries = Object.entries(breakdown).sort((a, b) => b[1].bytes - a[1].bytes);
	return (
		<section className='overflow-hidden rounded-xl border bg-card'>
			<div className='border-b bg-muted/30 px-5 py-4'>
				<h3 className='font-semibold'>{title}</h3>
			</div>
			{entries.length ? (
				<div className='divide-y'>
					{entries.map(([key, value]) => (
						<div key={key} className='flex items-center justify-between gap-4 px-5 py-3'>
							<div>
								<p className='text-sm font-medium capitalize'>{label(key)}</p>
								<p className='text-xs text-muted-foreground'>
									{value.files} file{value.files === 1 ? '' : 's'}
								</p>
							</div>
							<span className='font-mono text-xs text-muted-foreground'>
								{formatBytes(value.bytes)}
							</span>
						</div>
					))}
				</div>
			) : (
				<p className='px-5 py-8 text-center text-sm text-muted-foreground'>No storage usage yet.</p>
			)}
		</section>
	);
}

export function ProjectStorageTable({
	projects,
}: {
	projects: Array<{
		fileCount: number;
		id: string;
		limitBytes: number;
		name: string;
		reservedBytes: number;
		slug: string;
		usedBytes: number;
	}>;
}) {
	return (
		<section className='overflow-x-auto rounded-xl border bg-card'>
			<table className='w-full min-w-[620px] text-sm'>
				<thead>
					<tr className='border-b bg-muted/30 text-left text-xs tracking-wide text-muted-foreground uppercase'>
						<th className='px-5 py-3'>Project</th>
						<th className='px-4 py-3'>Files</th>
						<th className='px-4 py-3'>Used</th>
						<th className='px-4 py-3'>Reserved</th>
						<th className='px-5 py-3'>Limit</th>
					</tr>
				</thead>
				<tbody>
					{projects.length ? (
						projects.map((project) => (
							<tr key={project.id} className='border-b last:border-0'>
								<td className='px-5 py-3'>
									<p className='font-medium'>{project.name}</p>
									<p className='text-xs text-muted-foreground'>/{project.slug}</p>
								</td>
								<td className='px-4 py-3'>{project.fileCount}</td>
								<td className='px-4 py-3 font-mono text-xs'>{formatBytes(project.usedBytes)}</td>
								<td className='px-4 py-3 font-mono text-xs'>
									{formatBytes(project.reservedBytes)}
								</td>
								<td className='px-5 py-3 font-mono text-xs'>{formatBytes(project.limitBytes)}</td>
							</tr>
						))
					) : (
						<tr>
							<td colSpan={5} className='px-5 py-10 text-center text-muted-foreground'>
								No project storage usage yet.
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</section>
	);
}

export function formatBytes(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
	if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
	return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
}

function label(value: string) {
	return value.replaceAll('_', ' ');
}
