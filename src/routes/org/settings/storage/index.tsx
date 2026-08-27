import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { formatBytes, ProjectStorageTable } from '@/components/storage-usage';
import { useCRPC } from '@/lib/convex/crpc';
import { titleMeta } from '@/lib/seo';
import * as m from '@/paraglide/messages.js';

import { useSettingsOrgSlug } from '../-components/use-settings-org';

export const Route = createFileRoute('/org/settings/storage/')({
	head: () => ({ meta: [titleMeta(['Organization Storage'])] }),
	component: OrganizationStorageSettings,
});

function OrganizationStorageSettings() {
	const orgSlug = useSettingsOrgSlug();
	const crpc = useCRPC();
	const usage = useQuery(
		crpc.file.getOrgUsage.queryOptions(
			{ orgSlug: orgSlug ?? '' },
			{ enabled: !!orgSlug, skipUnauth: true }
		)
	);
	if (!orgSlug || usage.isPending)
		return <div className='h-48 animate-pulse rounded-xl bg-muted' />;
	if (usage.error) throw usage.error;
	const data = usage.data;
	return (
		<div className='space-y-6'>
			<header className='border-b pb-4'>
				<h2 className='text-xl font-semibold'>{m.settings_storage()}</h2>
				<p className='mt-1 text-sm text-muted-foreground'>{m.org_storage_description()}</p>
			</header>
			<div className='grid gap-4 sm:grid-cols-3'>
				<Metric label={m.storage_hosted_bytes()} value={formatBytes(data.totalUsedBytes)} />
				<Metric label={m.storage_uploading()} value={formatBytes(data.totalReservedBytes)} />
				<Metric label={m.project_nav_files()} value={String(data.totalFiles)} />
			</div>
			<div>
				<h3 className='mb-3 font-semibold'>{m.nav_your_projects()}</h3>
				<ProjectStorageTable projects={data.projects} />
			</div>
		</div>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className='rounded-xl border bg-card p-5'>
			<p className='text-sm text-muted-foreground'>{label}</p>
			<p className='mt-2 text-2xl font-semibold'>{value}</p>
		</div>
	);
}
