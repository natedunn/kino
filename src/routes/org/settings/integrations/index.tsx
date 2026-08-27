import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { CheckCircle2, GitBranch, RefreshCw } from 'lucide-react';

import { InlineAlert } from '@/components/inline-alert';
import { EmptyState } from '@/components/kino/common';
import { Button } from '@/components/ui/button';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { titleMeta } from '@/lib/seo';
import * as m from '@/paraglide/messages.js';

import { SettingsSkeleton } from '../-components/settings-skeleton';
import { useDelayedFlag } from '../-components/use-delayed-flag';
import { useSettingsOrgSlug } from '../-components/use-settings-org';

type IntegrationsSearch = { github?: string };

export const Route = createFileRoute('/org/settings/integrations/')({
	head: () => ({
		meta: [titleMeta(['Integrations'])],
	}),
	validateSearch: (search: Record<string, unknown>): IntegrationsSearch => ({
		github: typeof search.github === 'string' ? search.github : undefined,
	}),
	loader: ({ context, location }) => {
		const orgSlug = (location.search as { org?: string }).org;
		if (!context.loaderToken || !orgSlug) return;
		// Access (canEdit) is gated once on the `/org/settings` layout loader. Warm
		// the integration cache without blocking navigation.
		void context.queryClient.ensureQueryData(
			crpcServer.github.getOrgIntegration.queryOptions({ orgSlug }, { skipUnauth: true })
		);
	},
	component: IntegrationsSettingsRoute,
});

function IntegrationsSettingsRoute() {
	const orgSlug = useSettingsOrgSlug();
	const search = Route.useSearch();
	const crpc = useCRPC();

	const orgQuery = useQuery(
		crpc.org.getDetails.queryOptions(
			{ slug: orgSlug ?? '' },
			{ enabled: !!orgSlug, skipUnauth: true }
		)
	);
	// Only needs the slug (the loader warms this same query), so run it in
	// parallel with the org details query instead of waterfalling behind it.
	const integrationQuery = useQuery(
		crpc.github.getOrgIntegration.queryOptions(
			{
				orgSlug: orgSlug ?? '',
			},
			{ enabled: !!orgSlug, skipUnauth: true }
		)
	);
	const startConnection = useMutation(
		crpc.github.startOrgConnection.mutationOptions({
			onSuccess: (result) => {
				window.location.href = result.installUrl;
			},
		})
	);
	const refreshInstallations = useMutation(
		crpc.github.startOrgInstallationRefresh.mutationOptions({
			onSuccess: (result) => {
				window.location.href = result.authorizeUrl;
			},
		})
	);
	const installations = integrationQuery.data?.installations ?? [];
	const staleInstallations = integrationQuery.data?.staleInstallations ?? [];
	const knownInstallations = [...installations, ...staleInstallations];
	const hasInstallations = installations.length > 0;
	const hasStaleInstallations = staleInstallations.length > 0;
	const hasKnownInstallations = knownInstallations.length > 0;
	const staleInstallationIds = new Set(staleInstallations.map((installation) => installation.id));

	const isLoading = !orgSlug || orgQuery.isLoading || integrationQuery.isLoading;
	const showSkeleton = useDelayedFlag(isLoading);
	if (isLoading) {
		return showSkeleton ? <SettingsSkeleton /> : null;
	}

	if (!orgQuery.data?.org || !orgQuery.data.permissions.canEdit) {
		return (
			<EmptyState
				title={m.org_integrations_unavailable()}
				description={m.org_integrations_unavailable_description()}
			/>
		);
	}

	if (integrationQuery.error) {
		return (
			<EmptyState title={m.github_unavailable()} description={integrationQuery.error.message} />
		);
	}

	return (
		<div className='space-y-8'>
			<header className='border-b pb-4'>
				<h2 className='text-xl font-semibold'>{m.settings_integrations()}</h2>
				<p className='mt-1 text-sm text-muted-foreground'>
					Connect external services that power your projects. Install the Kino GitHub App on a
					GitHub organization or user account once, then any project here can pick a repository from
					those accounts.
				</p>
			</header>

			{search.github === 'connected' ? (
				<InlineAlert variant='success'>
					GitHub access connected. Project admins can now select a repository from this
					organization.
				</InlineAlert>
			) : null}
			{search.github === 'error' ? (
				<InlineAlert variant='danger'>{m.github_install_failed()}</InlineAlert>
			) : null}
			<div className='grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]'>
				<div className='space-y-6'>
					<section className='overflow-hidden rounded-xl border bg-card'>
						<div className='flex items-start gap-4 p-6'>
							<div className='flex size-11 shrink-0 items-center justify-center rounded-xl border bg-muted/40'>
								<GitBranch className='size-5' />
							</div>
							<div className='min-w-0 flex-1'>
								<div className='flex flex-wrap items-center gap-2'>
									<h3 className='text-base font-semibold'>GitHub</h3>
									{hasStaleInstallations ? (
										<span className='inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'>
											<RefreshCw className='size-3' />
											Needs attention
										</span>
									) : hasInstallations ? (
										<span className='inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'>
											<CheckCircle2 className='size-3' />
											Connected
										</span>
									) : (
										<span className='inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground'>
											Not connected
										</span>
									)}
								</div>
								<p className='mt-1 text-sm text-muted-foreground'>
									Sync issues and discussions between GitHub repositories and Kino feedback boards.
								</p>
							</div>
						</div>

						<div className='flex flex-wrap items-center gap-3 border-t bg-muted/30 px-6 py-4'>
							<Button
								disabled={startConnection.isPending}
								onClick={() =>
									startConnection.mutate({
										callbackTargetUrl: `${window.location.origin}/api/github/callback`,
										orgSlug,
									})
								}
								type='button'
							>
								<GitBranch className='size-4' />
								{hasKnownInstallations ? m.org_github_manage() : m.org_github_install()}
							</Button>
							{hasKnownInstallations ? (
								<Button
									disabled={refreshInstallations.isPending}
									onClick={() =>
										refreshInstallations.mutate({
											callbackTargetUrl: `${window.location.origin}/api/github/callback`,
											orgSlug,
										})
									}
									type='button'
									variant='outline'
								>
									<RefreshCw className='size-4' />
									Refresh accounts
								</Button>
							) : null}
						</div>
					</section>

					{startConnection.error ? (
						<InlineAlert variant='danger'>{startConnection.error.message}</InlineAlert>
					) : null}
					{refreshInstallations.error ? (
						<InlineAlert variant='danger'>{refreshInstallations.error.message}</InlineAlert>
					) : null}
					<section className='space-y-3'>
						<div className='flex items-center justify-between'>
							<h3 className='text-sm font-semibold'>{m.org_github_connected_accounts()}</h3>
							{hasKnownInstallations ? (
								<span className='text-xs text-muted-foreground'>
									{knownInstallations.length}{' '}
									{knownInstallations.length === 1 ? 'account' : 'accounts'}
								</span>
							) : null}
						</div>

						{!hasKnownInstallations ? (
							<div className='rounded-xl border border-dashed bg-muted/20 p-8 text-center'>
								<div className='mx-auto flex size-10 items-center justify-center rounded-full bg-background shadow-sm'>
									<GitBranch className='size-5 text-muted-foreground' />
								</div>
								<p className='mt-3 text-sm font-medium'>{m.org_github_no_accounts()}</p>
								<p className='mt-1 text-sm text-muted-foreground'>
									Install the Kino GitHub App above to get started.
								</p>
							</div>
						) : (
							<div className='grid gap-3 md:grid-cols-2'>
								{knownInstallations.map((installation) => {
									const isStale = staleInstallationIds.has(installation.id);

									return (
										<div
											className='rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20'
											key={installation.id}
										>
											<div className='flex items-center gap-3'>
												<div className='flex size-9 items-center justify-center rounded-lg border bg-background text-sm font-bold'>
													{installation.accountLogin[0]?.toUpperCase()}
												</div>
												<div className='min-w-0 flex-1'>
													<div className='truncate text-sm font-medium'>
														{installation.accountLogin}
													</div>
													<div className='text-xs text-muted-foreground'>
														{installation.accountType}
													</div>
												</div>
												{isStale ? (
													<span className='inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'>
														<RefreshCw className='size-3' />
														Needs refresh
													</span>
												) : null}
											</div>
											<div className='mt-3 inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground'>
												{installation.repositorySelection === 'all'
													? m.org_github_all_repositories()
													: m.org_github_selected_repositories()}
											</div>
										</div>
									);
								})}
							</div>
						)}
					</section>
				</div>

				<aside className='space-y-6'>
					<section className='rounded-xl border bg-card p-5'>
						<h3 className='font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase'>
							Project setup
						</h3>
						<p className='mt-2 text-sm text-muted-foreground'>
							Open a project&apos;s integrations page to select one repository from these connected
							accounts.
						</p>
					</section>
				</aside>
			</div>
		</div>
	);
}
