import { HardDrive } from 'lucide-react';

import * as m from '@/paraglide/messages.js';

type Breakdown = Record<string, { bytes: number; files: number }>;

const STORAGE_LABELS: Record<string, () => string> = {
	data: m.storage_label_data,
	design: m.storage_label_design,
	document: m.storage_label_document,
	feedback_attachment: m.storage_label_feedback_attachment,
	files: m.storage_label_files,
	image: m.storage_label_image,
	integration: m.storage_label_integration,
	org_avatar: m.storage_label_org_avatar,
	package: m.storage_label_package,
	project_header: m.storage_label_project_header,
	staff: m.storage_label_staff,
	system: m.storage_label_system,
	text: m.storage_label_text,
	update_body: m.storage_label_update_body,
	update_cover: m.storage_label_update_cover,
	user: m.storage_label_user,
	user_avatar: m.storage_label_user_avatar,
	video: m.storage_label_video,
	wiki_attachment: m.storage_label_wiki_attachment,
};

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
					<h3 className='font-semibold'>{m.storage_project()}</h3>
					<p className='mt-1 text-sm text-muted-foreground'>
						{m.storage_usage_summary({
							count: fileCount,
							limit: formatBytes(limitBytes),
							used: formatBytes(usedBytes),
						})}
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
					<span>
						{m.storage_percent_used({
							percent: committedPercent.toFixed(committedPercent < 1 ? 1 : 0),
						})}
					</span>
					<span>
						{reservedBytes
							? m.storage_uploading_amount({ amount: formatBytes(reservedBytes) })
							: m.storage_available_amount({
									amount: formatBytes(Math.max(0, limitBytes - usedBytes)),
								})}
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
									{m.storage_file_count({ count: value.files })}
								</p>
							</div>
							<span className='font-mono text-xs text-muted-foreground'>
								{formatBytes(value.bytes)}
							</span>
						</div>
					))}
				</div>
			) : (
				<p className='px-5 py-8 text-center text-sm text-muted-foreground'>{m.storage_empty()}</p>
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
						<th className='px-5 py-3'>{m.storage_table_project()}</th>
						<th className='px-4 py-3'>{m.storage_table_files()}</th>
						<th className='px-4 py-3'>{m.storage_table_used()}</th>
						<th className='px-4 py-3'>{m.storage_table_reserved()}</th>
						<th className='px-5 py-3'>{m.storage_table_limit()}</th>
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
								{m.storage_projects_empty()}
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
	return STORAGE_LABELS[value]?.() ?? value.replaceAll('_', ' ');
}
