import type { AppCommand } from '@/components/command';
import type { ReactNode } from 'react';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { PanelLeftOpen, Search, Settings2, SlidersHorizontal } from 'lucide-react';

import { useCommandPalette, useRegisterCommands } from '@/components/command';
import { RoutePending } from '@/components/route-pending';
import { Button } from '@/components/ui/button';
import {
	ResponsiveDialog,
	ResponsiveDialogBody,
	ResponsiveDialogContent,
	ResponsiveDialogHeader,
} from '@/components/ui/responsive-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import CirclePlusOutline from '@/icons/circle-plus-outline';
import Missing from '@/icons/missing';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { projectTitle, titleMeta } from '@/lib/seo';
import * as m from '@/paraglide/messages.js';

import { CategoriesNav } from './-components/categories-nav';
import { UpdateCard } from './-components/update-card';

const NUM_OF_ITEMS_PER_PAGE = 10;

type UpdateCategory = 'changelog' | 'article' | 'announcement';

type UpdateListArgs = {
	projectId: string;
	category?: UpdateCategory;
	cursor: string | null;
	limit: number;
};

function getUpdateListArgs({
	projectId,
	category,
	cursor,
}: Omit<UpdateListArgs, 'limit'>): UpdateListArgs {
	return {
		projectId,
		category,
		cursor,
		limit: NUM_OF_ITEMS_PER_PAGE,
	};
}

const UPDATE_CATEGORIES = new Set<UpdateCategory>(['changelog', 'article', 'announcement']);

function validateUpdatesSearch(search: Record<string, unknown>): {
	category?: UpdateCategory;
} {
	if (typeof search.category !== 'string') return {};
	const category = search.category.trim();
	return UPDATE_CATEGORIES.has(category as UpdateCategory)
		? { category: category as UpdateCategory }
		: {};
}

export const Route = createFileRoute('/@{$org}/$project/updates/')({
	component: UpdatesListRoute,
	loaderDeps: ({ search }) => ({ category: search.category }),
	loader: async ({ context, deps, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({
				orgSlug: params.org,
				slug: params.project,
			})
		);

		if (!projectData?.project) {
			throw notFound();
		}

		const firstPageOptions = crpcServer.update.listByProject.queryOptions(
			getUpdateListArgs({
				projectId: projectData.project.id,
				category: deps.category,
				cursor: null,
			})
		);

		if (typeof window === 'undefined') {
			await context.queryClient.ensureQueryData(firstPageOptions).catch(() => undefined);
			return;
		}

		void context.queryClient.prefetchQuery(firstPageOptions);
		void context.queryClient.prefetchQuery(
			crpcServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
		);
	},
	pendingComponent: () => <RoutePending variant='page' />,
	validateSearch: validateUpdatesSearch,
	head: ({ params }) => ({
		meta: [titleMeta([m.updates_meta(), projectTitle(params.org, params.project)])],
	}),
});

function Notice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
	return (
		<div className='text-bold flex items-center justify-center gap-3 rounded-lg border bg-muted p-4 text-xl text-muted-foreground md:p-10'>
			<div>{icon}</div>
			<div>{children}</div>
		</div>
	);
}

function UpdatesListSkeleton() {
	return (
		<div className='flex flex-col' aria-hidden='true'>
			{Array.from({ length: 4 }).map((_, index) => (
				<div key={index} className='border-b border-border/75 py-6 first:pt-0'>
					<Skeleton className='h-4 w-28' />
					<Skeleton className='mt-3 h-6 w-3/5' />
					<Skeleton className='mt-4 h-4 w-full' />
					<Skeleton className='mt-2 h-4 w-4/5' />
					<div className='mt-5 flex gap-2'>
						<Skeleton className='h-6 w-20' />
						<Skeleton className='h-6 w-24' />
					</div>
				</div>
			))}
		</div>
	);
}

function UpdatesSidebar({
	canEdit,
	orgSlug,
	projectSlug,
}: {
	canEdit: boolean;
	orgSlug: string;
	projectSlug: string;
}) {
	return (
		<div className='flex flex-col'>
			<div className='pb-6 pr-5'>
				<h2 className='mx-2 text-sm font-bold text-muted-foreground'>{m.updates_categories()}</h2>
				<div className='mt-2'>
					<CategoriesNav />
				</div>
			</div>
			{canEdit ? (
				<div className='-mr-5 border-t pt-6 pr-5'>
					<div>
						<h2 className='mx-2 text-sm font-bold text-muted-foreground'>{m.updates_actions()}</h2>
						<div className='mt-2 flex flex-col gap-3'>
							<Button asChild className='w-full'>
								<Link
									params={{ org: orgSlug, project: projectSlug }}
									to='/@{$org}/$project/updates/new'
								>
									<CirclePlusOutline size='16px' /> {m.updates_new()}
								</Link>
							</Button>
							<Button asChild className='w-full' variant='outline'>
								<Link
									params={{ org: orgSlug, project: projectSlug }}
									search={{ pageSize: 20 }}
									to='/@{$org}/$project/updates/edit'
								>
									<Settings2 className='size-4' /> {m.updates_manage()}
								</Link>
							</Button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}

function UpdatesListRoute() {
	const { org: orgSlug, project: projectSlug } = Route.useParams();
	const { category: categoryParam } = Route.useSearch();
	const crpc = useCRPC();
	const queryClient = useQueryClient();
	const { openUpdateSearch } = useCommandPalette();
	const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

	const updateCommands = useMemo<Array<AppCommand>>(() => {
		return [
			{
				closeOnRun: false,
				group: 'Navigation',
				icon: Search,
				id: 'updates.search',
				keywords: ['search', 'updates', 'changelog', 'announcement', 'article'],
				title: m.updates_command_search(),
				run: () => openUpdateSearch(),
			},
		];
	}, [openUpdateSearch]);

	useRegisterCommands('updates', updateCommands);

	const { data: projectData } = useSuspenseQuery(
		crpc.project.getDetails.queryOptions({
			orgSlug,
			slug: projectSlug,
		})
	);

	if (!projectData?.project) {
		throw notFound();
	}

	const projectId = projectData.project.id;
	const canEdit = projectData.permissions.canManageContent;
	const currentProfileQuery = useQuery(
		crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true, subscribe: false })
	);

	const firstPageArgs = getUpdateListArgs({
		projectId,
		category: categoryParam,
		cursor: null,
	});
	const firstPageKey = JSON.stringify(firstPageArgs);
	const firstPageQuery = useQuery(crpc.update.listByProject.queryOptions(firstPageArgs));
	const firstPage = firstPageQuery.data;
	const isInitialUpdatesLoading = firstPageQuery.isPending && !firstPage;
	const refreshingUpdates = firstPageQuery.isFetching && !isInitialUpdatesLoading;

	if (firstPageQuery.isError && !firstPage) {
		throw firstPageQuery.error;
	}

	const [additionalState, setAdditionalState] = useState<{
		key: string;
		pages: Array<NonNullable<typeof firstPage>>;
	}>({ key: firstPageKey, pages: [] });
	const [loadingMore, setLoadingMore] = useState(false);
	const [loadMoreErrorState, setLoadMoreErrorState] = useState<{
		error: Error | null;
		key: string;
	}>({
		error: null,
		key: firstPageKey,
	});

	const additionalPages = additionalState.key === firstPageKey ? additionalState.pages : [];
	const loadMoreError = loadMoreErrorState.key === firstPageKey ? loadMoreErrorState.error : null;
	const pages = firstPage ? [firstPage, ...additionalPages] : additionalPages;
	const lastPage = additionalPages.at(-1) ?? firstPage;
	const updates = pages
		.flatMap((page) => page.page)
		.filter(
			(item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index
		);
	const canLoadMore = !!lastPage && !lastPage.isDone && !!lastPage.continueCursor;

	async function loadMoreUpdates() {
		if (!canLoadMore || loadingMore) return;

		setLoadingMore(true);
		setLoadMoreErrorState({ error: null, key: firstPageKey });
		try {
			const nextPage = await queryClient.fetchQuery(
				crpc.update.listByProject.staticQueryOptions(
					getUpdateListArgs({
						projectId,
						category: categoryParam,
						cursor: lastPage.continueCursor,
					})
				)
			);
			setAdditionalState((state) => ({
				key: firstPageKey,
				pages: state.key === firstPageKey ? [...state.pages, nextPage] : [nextPage],
			}));
		} catch (error) {
			setLoadMoreErrorState({
				error: error instanceof Error ? error : new Error(m.updates_load_failed()),
				key: firstPageKey,
			});
		} finally {
			setLoadingMore(false);
		}
	}

	const controls = (
		<div className='flex min-w-0 items-center gap-2'>
			<Button className='min-w-0' onClick={() => openUpdateSearch()}>
				<Search className='size-3.5' /> {m.updates_search()}
			</Button>
			<Tooltip>
				<TooltipTrigger asChild delay={200}>
					<Button
						aria-label={m.updates_advanced_search_aria()}
						asChild
						size='icon'
						variant='outline'
					>
						<Link
							params={{ org: orgSlug, project: projectSlug }}
							to='/@{$org}/$project/updates/search'
						>
							<SlidersHorizontal className='size-3.5' />
						</Link>
					</Button>
				</TooltipTrigger>
				<TooltipContent side='bottom'>{m.updates_advanced_search()}</TooltipContent>
			</Tooltip>
		</div>
	);

	return (
		<>
			<div className='relative flex w-full min-w-0 flex-1 flex-col overflow-x-hidden'>
				<div
					aria-hidden='true'
					className='pointer-events-none absolute inset-x-0 top-20 border-b'
				/>
				<div className='container flex w-full min-w-0 flex-1 flex-col'>
					<div className='flex w-full max-w-full min-w-0 flex-1 flex-col lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]'>
						<aside className='hidden h-full min-h-0 min-w-0 overflow-hidden border-r border-border/75 lg:block'>
							<div className='sticky top-0 flex h-full w-[17rem] max-w-none flex-col overflow-hidden'>
								<div className='flex h-[81px] shrink-0 items-center pr-5'>{controls}</div>
								<div className='mt-4 min-h-0 flex-1 overflow-visible pr-5 pb-6'>
									<UpdatesSidebar canEdit={canEdit} orgSlug={orgSlug} projectSlug={projectSlug} />
								</div>
							</div>
						</aside>

						<div className='flex h-full min-h-0 w-full max-w-full min-w-0 flex-1 flex-col'>
							<div className='flex h-[81px] min-w-0 shrink-0 items-center lg:pl-7'>
								<div className='flex w-full min-w-0 items-center justify-between gap-3'>
									<div className='flex min-w-0 items-center gap-3 lg:hidden'>
										<Tooltip
											onOpenChange={(open, eventDetails) => {
												if (open && eventDetails.reason === 'trigger-focus') {
													eventDetails.cancel();
												}
											}}
										>
											<TooltipTrigger asChild delay={200}>
												<Button
													aria-controls='updates-sidebar-dialog'
													aria-expanded={mobileSidebarOpen}
													aria-label={m.updates_show_categories()}
													onClick={() => setMobileSidebarOpen(true)}
													size='icon'
													variant='outline'
												>
													<PanelLeftOpen />
												</Button>
											</TooltipTrigger>
											<TooltipContent side='bottom'>{m.updates_categories()}</TooltipContent>
										</Tooltip>
									</div>
									<Button className='shrink-0' variant='outline'>
										{m.feedback_follow()}
									</Button>
								</div>
							</div>

							<div
								aria-busy={isInitialUpdatesLoading || refreshingUpdates || loadingMore}
								aria-live='polite'
								className='flex w-full max-w-full min-w-0 flex-1 flex-col gap-4 overflow-visible pb-8 lg:pl-7'
							>
								<div className='w-full'>
									{isInitialUpdatesLoading ? (
										<>
											<span className='sr-only'>{m.updates_loading()}</span>
											<UpdatesListSkeleton />
										</>
									) : null}
									{!isInitialUpdatesLoading && updates.length === 0 ? (
										<div className='pt-6'>
											<Notice icon={<Missing aria-hidden='true' size='32px' />}>
												{m.updates_empty()}
											</Notice>
										</div>
									) : null}
									{updates.length > 0 ? (
										<>
											<ul className='flex flex-col'>
												{updates.map((update, index) => (
													<UpdateCard
														key={update.id}
														currentProfileId={currentProfileQuery.data?.id}
														isLast={!canLoadMore && index === updates.length - 1}
														orgSlug={orgSlug}
														projectSlug={projectSlug}
														update={update}
													/>
												))}
											</ul>
											{canLoadMore ? (
												<div className='flex justify-center pt-2'>
													<Button
														disabled={loadingMore}
														onClick={() => void loadMoreUpdates()}
														variant='outline'
													>
														{loadingMore ? m.updates_loading_more() : m.updates_load_more()}
													</Button>
												</div>
											) : null}
											{loadMoreError ? (
												<p className='text-center text-sm text-destructive'>
													{loadMoreError.message}
												</p>
											) : null}
										</>
									) : null}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<ResponsiveDialog onOpenChange={setMobileSidebarOpen} open={mobileSidebarOpen}>
				<ResponsiveDialogContent
					id='updates-sidebar-dialog'
					className='flex flex-col gap-0 overflow-hidden p-0'
					dialogClassName='sm:max-w-md'
					showCloseButton={false}
				>
					<ResponsiveDialogHeader icon={<PanelLeftOpen />} title={m.updates_categories()} />
					<ResponsiveDialogBody className='p-3'>
						<div className='mb-3 border-b pb-3'>{controls}</div>
						<UpdatesSidebar canEdit={canEdit} orgSlug={orgSlug} projectSlug={projectSlug} />
					</ResponsiveDialogBody>
				</ResponsiveDialogContent>
			</ResponsiveDialog>
		</>
	);
}
