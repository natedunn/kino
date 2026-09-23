import type { ReactNode } from 'react';
import type { Id } from '../../../../../../convex/native/_generated/dataModel';

import { useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, notFound, useParams, useRouter, useSearch } from '@tanstack/react-router';
import { PanelLeftOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
	ResponsiveDialog,
	ResponsiveDialogBody,
	ResponsiveDialogContent,
	ResponsiveDialogHeader,
} from '@/components/ui/responsive-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import CirclePlusOutline from '@/icons/circle-plus-outline';
import Missing from '@/icons/missing';
import { useAuthSession } from '@/lib/auth/auth-client';
import { localizeError } from '@/lib/errors';
import * as m from '@/paraglide/messages.js';

import { api as nativeApi } from '../../../../../../convex/native/_generated/api';
import { BoardsNav } from './boards-nav';
import { FeedbackCard } from './feedback-card';
import { FeedbackOptions } from './feedback-options';
import { FeedbackToolbar } from './feedback-toolbar';

const ROUTE = '/@{$org}/$project/feedback/' as const;
const PAGE_SIZE = 50;
type NativeBoard = { id: Id<'feedbackBoards'>; icon: string | null; name: string; slug: string };

function Notice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
	return (
		<div className='text-bold flex items-center justify-center gap-3 rounded-lg border bg-muted p-4 text-xl text-muted-foreground md:p-10'>
			<div>{icon}</div>
			<div>{children}</div>
		</div>
	);
}

function FeedbackListSkeleton() {
	return (
		<div className='flex flex-col gap-4' aria-hidden='true'>
			{Array.from({ length: 5 }).map((_, index) => (
				<div key={index} className='rounded-lg border p-5'>
					<div className='flex items-start justify-between gap-4'>
						<div className='min-w-0 flex-1'>
							<Skeleton className='h-5 w-3/5' />
							<Skeleton className='mt-3 h-4 w-full' />
							<Skeleton className='mt-2 h-4 w-2/3' />
						</div>
						<Skeleton className='size-10 shrink-0 rounded-md' />
					</div>
				</div>
			))}
		</div>
	);
}

export function NativeFeedbackListRoute() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { org, project } = useParams({ from: ROUTE });
	const { board, search, status } = useSearch({ from: ROUTE });
	const session = useAuthSession();
	const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);

	const { data: projectData } = useSuspenseQuery(
		convexQuery(nativeApi.projects.getBySlugs, {
			organizationSlug: org,
			projectSlug: project,
		})
	);
	if (!projectData?.project) throw notFound();
	const projectId = projectData.project.id;
	const { data: boards } = useSuspenseQuery(
		convexQuery(nativeApi.feedbackBoards.list, { projectId })
	);
	const boardId = (boards as Array<NativeBoard> | null)?.find((item) => item.slug === board)?.id;
	const firstArgs = {
		projectId,
		...(boardId ? { boardId } : {}),
		...(search ? { search } : {}),
		...(status ? { status } : {}),
		paginationOpts: { cursor: null, numItems: PAGE_SIZE },
	};
	const firstKey = JSON.stringify(firstArgs);
	const firstQuery = useQuery(convexQuery(nativeApi.feedback.list, firstArgs));
	const firstPage = firstQuery.data;
	if (firstQuery.isError && !firstPage) throw firstQuery.error;

	const [moreState, setMoreState] = useState<{
		key: string;
		pages: Array<NonNullable<typeof firstPage>>;
	}>({ key: firstKey, pages: [] });
	const [loadingMore, setLoadingMore] = useState(false);
	const morePages = moreState.key === firstKey ? moreState.pages : [];
	const pages = firstPage ? [firstPage, ...morePages] : morePages;
	const lastPage = morePages.at(-1) ?? firstPage;
	const feedback = pages
		.flatMap((page) => page?.page ?? [])
		.filter(
			(item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index
		);
	const canLoadMore = !!lastPage && !lastPage.isDone && !!lastPage.continueCursor;

	async function loadMore() {
		if (!canLoadMore || loadingMore || !lastPage) return;
		setLoadError(null);
		setLoadingMore(true);
		try {
			const next = await queryClient.fetchQuery(
				convexQuery(nativeApi.feedback.list, {
					...firstArgs,
					paginationOpts: { cursor: lastPage.continueCursor, numItems: PAGE_SIZE },
				})
			);
			if (next) {
				setMoreState((state) => ({
					key: firstKey,
					pages: state.key === firstKey ? [...state.pages, next] : [next],
				}));
			}
		} catch (error) {
			setLoadError(localizeError(error, m.feedback_index_load_more_failed()));
		} finally {
			setLoadingMore(false);
		}
	}

	const sidebar = (
		<>
			<div className='-mr-5 border-b pr-5 pb-6'>
				<h2 className='mx-2 text-sm font-bold text-muted-foreground'>
					{m.feedback_index_boards()}
				</h2>
				<div className='mt-2'>
					<BoardsNav boards={boards} />
				</div>
			</div>
			{projectData.permissions.canManageContent ? (
				<div className='mt-6 pb-6'>
					<h2 className='mx-2 text-sm font-bold text-muted-foreground'>
						{m.feedback_index_actions()}
					</h2>
					<div className='mt-2'>
						<FeedbackOptions />
					</div>
				</div>
			) : null}
		</>
	);

	return (
		<>
			<div className='relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden lg:h-[calc(100dvh-9.75rem)] lg:flex-none'>
				<div
					aria-hidden='true'
					className='pointer-events-none absolute inset-x-0 top-20 border-b'
				/>
				<div className='container flex min-h-0 w-full min-w-0 flex-1 flex-col'>
					<div className='flex min-h-0 w-full max-w-full min-w-0 flex-1 flex-col lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]'>
						<aside className='hidden h-full min-h-0 min-w-0 overflow-hidden border-r border-border/75 lg:block'>
							<div className='sticky top-0 flex h-full w-[17rem] flex-col overflow-hidden'>
								<div className='flex h-[81px] shrink-0 items-center pr-5'>
									<Button asChild>
										<Link params={{ org, project }} to='/@{$org}/$project/feedback/new'>
											<CirclePlusOutline size='16px' />
											{m.feedback_index_add_feedback()}
										</Link>
									</Button>
								</div>
								<div className='mt-4 min-h-0 flex-1 overflow-y-auto pr-5 pb-6'>{sidebar}</div>
							</div>
						</aside>
						<div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
							<div className='flex h-[81px] shrink-0 items-center lg:pl-7'>
								<FeedbackToolbar
									leadingControl={
										<Button
											aria-label={m.feedback_index_browse_sidebar()}
											className='lg:hidden'
											onClick={() => setMobileSidebarOpen(true)}
											size='icon'
											variant='outline'
										>
											<PanelLeftOpen />
										</Button>
									}
									topRowClassName='w-full'
								/>
							</div>
							<div
								aria-busy={firstQuery.isPending || loadingMore}
								className='flex min-h-0 flex-1 flex-col overflow-y-auto py-6 lg:pl-7'
							>
								{firstQuery.isPending ? <FeedbackListSkeleton /> : null}
								{!firstQuery.isPending && feedback.length === 0 ? (
									<Notice icon={<Missing aria-hidden='true' size='32px' />}>
										{m.feedback_index_empty()}
									</Notice>
								) : null}
								{loadError ? (
									<p
										aria-live='polite'
										className='mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive'
										role='alert'
									>
										{loadError}
									</p>
								) : null}
								{feedback.length ? (
									<ul className='flex flex-col gap-4'>
										{feedback.map((item) => {
											const link = {
												params: { org, project, slug: item.slug },
												to: '/@{$org}/$project/feedback/$slug',
											} as const;
											const location = router.buildLocation(link);
											return (
												<FeedbackCard
													key={item.id}
													feedback={item}
													href={router.history.createHref(location.publicHref) || '/'}
													isAuthenticated={!!session.user}
													onNavigationClick={() => router.navigate(link)}
													onPreload={() => router.preloadRoute(link)}
												/>
											);
										})}
									</ul>
								) : null}
								{canLoadMore ? (
									<div className='mt-4'>
										<Button
											disabled={loadingMore}
											onClick={() => void loadMore()}
											variant='outline'
										>
											{loadingMore ? m.feedback_index_loading() : m.feedback_index_load_more()}
										</Button>
									</div>
								) : null}
							</div>
						</div>
					</div>
				</div>
			</div>
			<ResponsiveDialog onOpenChange={setMobileSidebarOpen} open={mobileSidebarOpen}>
				<ResponsiveDialogContent
					className='flex flex-col gap-0 overflow-hidden p-0'
					dialogClassName='sm:max-w-md'
					showCloseButton={false}
				>
					<ResponsiveDialogHeader
						icon={<PanelLeftOpen />}
						title={m.feedback_index_browse_sidebar()}
					/>
					<ResponsiveDialogBody className='p-3'>
						<div className='mb-3 border-b pb-3'>
							<Button asChild>
								<Link params={{ org, project }} to='/@{$org}/$project/feedback/new'>
									<CirclePlusOutline size='16px' />
									{m.feedback_index_add_feedback()}
								</Link>
							</Button>
						</div>
						{sidebar}
					</ResponsiveDialogBody>
				</ResponsiveDialogContent>
			</ResponsiveDialog>
		</>
	);
}
