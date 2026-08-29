import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { GitBranch, ShieldCheck, Unplug } from 'lucide-react';

import { InlineAlert } from '@/components/inline-alert';
import { EmptyState } from '@/components/kino/common';
import { Label, LabelDescription, LabelWrapper } from '@/components/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { localizeGitHubError } from '@/lib/i18n/github-errors';
import { titleMeta } from '@/lib/seo';
import * as m from '@/paraglide/messages.js';

import { ArchivedSettingsNotice } from '../-components/archived-notice';

type ConnectionMode = 'read' | 'read_write';
type Source = 'issues' | 'discussions';

const connectionModeLabels: Record<ConnectionMode, () => string> = {
	read: m.github_read_only,
	read_write: m.github_read_write,
};

type RepositoryOption = {
	fullName: string;
	id: number;
	name: string;
	owner: string;
	private: boolean;
};

export const Route = createFileRoute('/@{$org}/$project/settings/integrations/')({
	head: () => ({
		meta: [titleMeta([m.meta_integrations()])],
	}),
	component: GitHubIntegrationRoute,
	loader: async ({ context, params }) => {
		if (!context.loaderToken) return;
		await context.queryClient.ensureQueryData(
			crpcServer.github.getProjectIntegration.queryOptions({
				orgSlug: params.org,
				projectSlug: params.project,
			})
		);
	},
});

function GitHubIntegrationRoute() {
	const params = Route.useParams();
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- route has no validateSearch, so useSearch() is typed `{}`; assertion is required for tsc
	const search = Route.useSearch() as { github?: string };
	const crpc = useCRPC();
	const [modeOverride, setModeOverride] = useState<ConnectionMode | null>(null);
	const [selectedInstallationId, setSelectedInstallationId] = useState<number | null>(null);
	const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
	const [repositoriesInstallationId, setRepositoriesInstallationId] = useState<number | null>(null);
	const [sourcesOverride, setSourcesOverride] = useState<Array<Source> | null>(null);

	const integrationQuery = useQuery(
		crpc.github.getProjectIntegration.queryOptions({
			orgSlug: params.org,
			projectSlug: params.project,
		})
	);
	// Cached by the settings route loader — cheap read just to flag the frozen state.
	const detailsQuery = useQuery(
		crpc.project.getDetails.queryOptions({ orgSlug: params.org, slug: params.project })
	);
	const isArchived = detailsQuery.data?.project?.visibility === 'archived';
	const repositoriesQuery = useMutation(
		crpc.githubExternal.listInstallationRepositoriesForProject.mutationOptions()
	);
	const connectRepository = useMutation(
		// No manual refetch: `getProjectIntegration` is a live Convex subscription,
		// so writing the connection server-side pushes the update automatically.
		crpc.githubExternal.connectRepository.mutationOptions()
	);
	const disconnectRepository = useMutation(
		crpc.github.disconnectRepository.mutationOptions({
			onSuccess: () => {
				connectRepository.reset();
				setModeOverride(null);
				setSelectedRepoId(null);
				setSelectedInstallationId(null);
				setSourcesOverride(null);
			},
		})
	);
	const installations = integrationQuery.data?.installations ?? [];
	const staleInstallations = integrationQuery.data?.staleInstallations ?? [];
	const connections = integrationQuery.data?.connections ?? [];
	const activeConnection = connections[0] ?? null;
	const connectedInstallation = activeConnection
		? installations.find((item) => item.id === activeConnection.githubInstallationId)
		: null;
	const selectedInstallation =
		installations.find((installation) => installation.installationId === selectedInstallationId) ??
		connectedInstallation ??
		installations[0];
	const activeInstallationId = selectedInstallation?.installationId ?? null;
	const connectionRepoId =
		activeConnection && connectedInstallation?.installationId === activeInstallationId
			? activeConnection.repoId
			: null;
	const mode = modeOverride ?? (activeConnection?.mode as ConnectionMode | undefined) ?? 'read';
	const sources =
		sourcesOverride ??
		(activeConnection && activeConnection.enabledSources.length > 0
			? (activeConnection.enabledSources as Array<Source>)
			: ['issues']);
	const repositories =
		repositoriesInstallationId === activeInstallationId ? (repositoriesQuery.data ?? []) : [];
	// Only honor an explicit selection when it actually exists in the loaded
	// repository list; otherwise (e.g. the repo was removed on GitHub, or the
	// list just changed) fall back to the connected repo instead of showing an
	// empty Select.
	const selectionInList =
		selectedRepoId !== null && repositories.some((repository) => repository.id === selectedRepoId)
			? selectedRepoId
			: null;
	const effectiveSelectedRepoId = selectionInList ?? connectionRepoId;
	const selectedRepository = repositories.find(
		(repository) => repository.id === effectiveSelectedRepoId
	);
	const selectedRepositoryValue = selectedRepository ? String(selectedRepository.id) : '';
	const hasInstallations = installations.length > 0;
	const hasKnownInstallations = hasInstallations || staleInstallations.length > 0;
	const needsGitHubRefresh = staleInstallations.length > 0;

	useEffect(() => {
		if (!activeInstallationId) {
			repositoriesQuery.reset();
			setRepositoriesInstallationId(null);
			setSelectedRepoId(null);
			return;
		}

		repositoriesQuery.reset();
		setRepositoriesInstallationId(activeInstallationId);
		repositoriesQuery.mutate({
			installationId: activeInstallationId,
			orgSlug: params.org,
		});
		// `repositoriesQuery` is a TanStack mutation whose identity changes every
		// render; sync only when the selected installation (or org) changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeInstallationId, params.org]);

	function toggleSource(source: Source) {
		setSourcesOverride((currentSources) => {
			const current = currentSources ?? sources;
			if (current.includes(source)) {
				return current.length === 1 ? current : current.filter((item) => item !== source);
			}
			return [...current, source];
		});
	}

	function handleInstallationChange(value: string | null) {
		if (value === null || value === '') return;

		const nextInstallationId = Number(value);
		if (!Number.isFinite(nextInstallationId)) return;
		if (nextInstallationId === activeInstallationId) return;

		setSelectedInstallationId(nextInstallationId);
		setRepositoriesInstallationId(null);
		setSelectedRepoId(null);
	}

	function handleRepositoryChange(value: string | null) {
		if (value === null || value === '') return;

		const nextRepoId = Number(value);
		if (!Number.isFinite(nextRepoId)) return;

		setSelectedRepoId(nextRepoId);
	}

	if (integrationQuery.isLoading) {
		return <div className='h-64 animate-pulse rounded-xl border bg-muted/30' />;
	}

	if (integrationQuery.error) {
		return (
			<EmptyState
				title={m.github_unavailable()}
				description={localizeGitHubError(integrationQuery.error)}
			/>
		);
	}

	return (
		<div className='space-y-8'>
			<header className='border-b pb-4'>
				<h2 className='text-xl font-semibold'>{m.settings_integrations()}</h2>
				<p className='mt-1 text-sm text-muted-foreground'>{m.project_integrations_description()}</p>
			</header>

			{isArchived ? <ArchivedSettingsNotice /> : null}

			{search.github === 'connected' ? (
				<InlineAlert variant='success'>{m.project_github_connected_notice()}</InlineAlert>
			) : null}
			{search.github === 'error' ? (
				<InlineAlert variant='danger'>{m.github_install_failed()}</InlineAlert>
			) : null}
			{needsGitHubRefresh ? (
				<InlineAlert variant='warning'>{m.project_github_refresh_notice()}</InlineAlert>
			) : null}
			{!hasKnownInstallations && !needsGitHubRefresh ? (
				<InlineAlert variant='warning'>{m.project_github_connect_notice()}</InlineAlert>
			) : null}
			<div className='space-y-6'>
				<section className='overflow-hidden rounded-xl border bg-card'>
					<div className='flex items-start gap-4 border-b p-6'>
						<div className='flex size-11 shrink-0 items-center justify-center rounded-xl border bg-muted/40'>
							<GitBranch className='size-5' />
						</div>
						<div className='min-w-0 flex-1'>
							<h3 className='text-base font-semibold'>{m.github_connect_repository()}</h3>
							<p className='mt-1 text-sm text-muted-foreground'>
								{m.project_github_connect_description()}
							</p>
						</div>
					</div>

					<div className='space-y-6 p-6'>
						<div className='flex flex-col gap-2'>
							<LabelWrapper>
								<Label>{m.github_account()}</Label>
								<LabelDescription>{m.project_github_accounts_description()}</LabelDescription>
							</LabelWrapper>
							<div className='flex flex-wrap items-center gap-3'>
								<Select
									items={installations.map((installation) => ({
										label: installation.accountLogin,
										value: String(installation.installationId),
									}))}
									onValueChange={handleInstallationChange}
									value={activeInstallationId ? String(activeInstallationId) : ''}
								>
									<SelectTrigger className='min-w-60'>
										<SelectValue placeholder={m.github_no_account()} />
									</SelectTrigger>
									<SelectContent>
										{installations.map((installation) => (
											<SelectItem key={installation.id} value={String(installation.installationId)}>
												{installation.accountLogin}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Button asChild type='button' variant='outline'>
									<Link search={{ org: params.org }} to='/org/settings/integrations'>
										<GitBranch className='size-4' />
										{m.project_github_manage_access()}
									</Link>
								</Button>
							</div>
						</div>

						<div className='flex flex-col gap-2'>
							<LabelWrapper>
								<Label>{m.project_general_repository()}</Label>
								<LabelDescription>{m.project_github_repository_description()}</LabelDescription>
							</LabelWrapper>
							<div className='space-y-2'>
								<Select
									disabled={!activeInstallationId || repositoriesQuery.isPending}
									items={repositories.map((repository: RepositoryOption) => ({
										label: repository.fullName,
										value: String(repository.id),
									}))}
									onValueChange={handleRepositoryChange}
									value={selectedRepositoryValue}
								>
									<SelectTrigger className='min-w-72'>
										<SelectValue
											placeholder={
												repositoriesQuery.isPending
													? m.github_loading_repositories()
													: m.github_select_repository()
											}
										/>
									</SelectTrigger>
									<SelectContent>
										{repositories.map((repository: RepositoryOption) => (
											<SelectItem key={repository.id} value={String(repository.id)}>
												{repository.fullName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{activeInstallationId && repositoriesQuery.isPending ? (
									<p className='text-xs text-muted-foreground'>{m.project_github_loading()}</p>
								) : null}
								{activeInstallationId &&
								!repositoriesQuery.isPending &&
								repositories.length === 0 &&
								!repositoriesQuery.error ? (
									<p className='text-xs text-muted-foreground'>
										{m.project_github_no_repositories()}
									</p>
								) : null}
							</div>
						</div>

						<div className='flex flex-col gap-2'>
							<LabelWrapper>
								<Label>{m.github_sources()}</Label>
								<LabelDescription>{m.project_github_sources_description()}</LabelDescription>
							</LabelWrapper>
							<div className='flex gap-4 pt-2'>
								<label className='flex items-center gap-2 text-sm'>
									<Checkbox
										checked={sources.includes('issues')}
										onCheckedChange={() => toggleSource('issues')}
									/>
									{m.github_issues()}
								</label>
								<label className='flex items-center gap-2 text-sm'>
									<Checkbox
										checked={sources.includes('discussions')}
										onCheckedChange={() => toggleSource('discussions')}
									/>
									{m.github_discussions()}
								</label>
							</div>
						</div>

						<div className='flex flex-col gap-2'>
							<LabelWrapper>
								<Label>{m.github_sync_mode()}</Label>
								<LabelDescription>{m.github_sync_description()}</LabelDescription>
							</LabelWrapper>
							<Select onValueChange={(value) => setModeOverride(value)} value={mode}>
								<SelectTrigger className='w-full sm:w-48'>
									<SelectValue>
										{(value: ConnectionMode | null) =>
											value ? connectionModeLabels[value]() : m.github_select_mode()
										}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='read'>{m.github_read_only()}</SelectItem>
									<SelectItem value='read_write'>{m.github_read_write()}</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className='flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4'>
						<p className='text-xs text-muted-foreground'>
							{m.project_github_verification_description()}
						</p>
						<Button
							disabled={!activeInstallationId || !selectedRepository || connectRepository.isPending}
							onClick={() => {
								if (!activeInstallationId || !selectedRepository) return;
								connectRepository.mutate({
									enabledSources: sources,
									installationId: activeInstallationId,
									mode,
									orgSlug: params.org,
									projectSlug: params.project,
									repoId: selectedRepository.id,
								});
							}}
							type='button'
						>
							<ShieldCheck className='size-4' />
							{m.project_github_verify_save()}
						</Button>
					</div>
				</section>

				{repositoriesQuery.error ? (
					<InlineAlert variant='danger'>{localizeGitHubError(repositoriesQuery.error)}</InlineAlert>
				) : null}
				{connectRepository.error ? (
					<InlineAlert variant='danger'>{localizeGitHubError(connectRepository.error)}</InlineAlert>
				) : null}
				{connectRepository.isSuccess ? (
					<InlineAlert variant='success'>{m.github_settings_saved()}</InlineAlert>
				) : null}

				{activeConnection ? (
					<section className='overflow-hidden rounded-xl border border-destructive/30 bg-card'>
						<div className='p-6'>
							<h3 className='text-sm font-semibold text-destructive'>{m.security_danger_zone()}</h3>
							<p className='mt-1 text-sm text-muted-foreground'>
								{m.project_github_disconnect_description()}
							</p>
						</div>
						<div className='flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4'>
							<p className='text-xs text-muted-foreground'>
								{m.project_github_disconnect_warning()}
							</p>
							<Button
								disabled={disconnectRepository.isPending}
								onClick={() => {
									if (!window.confirm(m.project_github_disconnect_confirm())) {
										return;
									}
									disconnectRepository.mutate({
										connectionId: activeConnection.id,
										orgSlug: params.org,
										projectSlug: params.project,
									});
								}}
								type='button'
								variant='destructive'
							>
								<Unplug className='size-4' />
								{disconnectRepository.isPending ? m.github_disconnecting() : m.github_disconnect()}
							</Button>
						</div>
						{disconnectRepository.error ? (
							<div className='border-t px-6 py-4'>
								<InlineAlert variant='danger'>
									{localizeGitHubError(disconnectRepository.error)}
								</InlineAlert>
							</div>
						) : null}
					</section>
				) : null}
			</div>
		</div>
	);
}
