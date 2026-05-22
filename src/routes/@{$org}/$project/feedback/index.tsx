import type { ReactNode } from 'react';

import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router';
import { z } from 'zod';

import { RoutePending } from '@/components/route-pending';
import { Button } from '@/components/ui/button';
import ArchivePencil from '@/icons/archive-pencil';
import CirclePlusOutline from '@/icons/circle-plus-outline';
import Missing from '@/icons/missing';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcOptions } from '@/lib/convex/crpc-options';
import { preloadCRPCQuery } from '@/lib/convex/preload';
import { cn } from '@/lib/utils';
import { api } from '@convex/api';

import { BoardsNav } from './-components/boards-nav';
import { FeedbackCard } from './-components/feedback-card';
import { FeedbackOptions } from './-components/feedback-options';
import { FeedbackToolbar } from './-components/feedback-toolbar';

const NUM_OF_ITEMS_PER_PAGE = 50;

type BoardSummary = {
  id: string;
  slug: string;
};

type ProjectDetailsData = {
  project?: {
    id: string;
  } | null;
};

const feedbackSearchParams = z.object({
  board: z.optional(z.string()).default('all'),
  search: z.optional(z.string().transform((value) => (value?.trim() === '' ? undefined : value))),
  status: z.optional(
    z
      .enum(['open', 'in-progress', 'closed', 'completed', 'paused'])
      .transform((value) => (value?.trim() === '' ? undefined : value))
  ),
});

export const Route = createFileRoute('/@{$org}/$project/feedback/')({
  component: FeedbackListRoute,
  loaderDeps: ({ search: { board, search, status } }) => ({ board, search, status }),
  loader: async ({ context, deps, params }) => {
    const projectArgs = {
      orgSlug: params.org,
      slug: params.project,
    };
    const projectOptions = crpcOptions.project.getDetails.staticQueryOptions(projectArgs);
    const projectData = await preloadCRPCQuery<ProjectDetailsData, typeof projectArgs>(
      context.queryClient,
      projectOptions,
      api.project.getDetails,
      projectArgs
    );

    if (!projectData?.project?.id) {
      throw notFound();
    }

    const boardsArgs = {
      projectId: projectData.project.id,
    };
    const boardsOptions = crpcOptions.feedbackBoard.listProjectBoards.staticQueryOptions(boardsArgs);
    const boards = await preloadCRPCQuery<BoardSummary[] | null, typeof boardsArgs>(
      context.queryClient,
      boardsOptions,
      api.feedbackBoard.listProjectBoards,
      boardsArgs
    );
    const boardId = getBoardId(boards, deps.board);

    const feedbackArgs = {
      boardId,
      paginationLimit: NUM_OF_ITEMS_PER_PAGE,
      projectId: projectData.project.id,
      search: deps.search,
      status: deps.status,
    };
    const feedbackOptions = crpcOptions.feedback.listProjectFeedback.staticQueryOptions(feedbackArgs);
    await preloadCRPCQuery(context.queryClient, feedbackOptions, api.feedback.listProjectFeedback, feedbackArgs);
  },
  pendingComponent: () => <RoutePending variant="sidebar" />,
  pendingMs: 150,
  validateSearch: feedbackSearchParams,
});

function getBoardId(boards: BoardSummary[] | null | undefined, boardSlug: string | undefined) {
  return boards?.find((item) => item.slug === boardSlug)?.id ?? 'all';
}

function Notice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="text-bold flex items-center justify-center gap-3 rounded-lg border bg-muted p-4 text-xl text-muted-foreground md:p-10">
      <div>{icon}</div>
      <div>{children}</div>
    </div>
  );
}

function FeedbackListRoute() {
  const router = useRouter();
  const searchParams = Route.useSearch();
  const { search, status, board } = searchParams;
  const { org: orgSlug, project: projectSlug } = Route.useParams();
  const crpc = useCRPC();

  const { data: projectData } = useSuspenseQuery(
    crpc.project.getDetails.queryOptions(
      {
        orgSlug,
        slug: projectSlug,
      }
    )
  );

  if (!projectData?.project) {
    throw notFound();
  }

  const { data: boards } = useSuspenseQuery(
    crpc.feedbackBoard.listProjectBoards.queryOptions(
      {
        projectId: projectData.project.id,
      }
    )
  );
  const profileQuery = useQuery(
    crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
  );
  const boardId = getBoardId(boards, board);
  const feedbackQuery = useSuspenseQuery(
    crpc.feedback.listProjectFeedback.queryOptions(
      {
        boardId,
        paginationLimit: NUM_OF_ITEMS_PER_PAGE,
        projectId: projectData.project.id,
        search,
        status,
      }
    )
  );

  const loadingFeedback = feedbackQuery.isFetching;
  const feedback = feedbackQuery.data?.page ?? [];

  return (
    <div className="container h-full overflow-visible">
      <div className="h-full grid-cols-12 gap-8 md:grid">
        <div className="order-first border-l border-border/75 py-6 md:order-last md:col-span-3">
          <div className="sticky top-6 flex flex-col overflow-hidden">
            <div className="border-b pb-6 pl-6">
              <Button asChild className="w-full" size="lg">
                <Link params={{ org: orgSlug, project: projectSlug }} to="/@{$org}/$project/feedback/new">
                  <CirclePlusOutline size="16px" /> Add feedback
                </Link>
              </Button>
            </div>
            <div className="mt-4">
              <div className="border-b pb-6 pl-6">
                <h2 className="mx-2 text-sm font-bold text-muted-foreground">Boards</h2>
                <div className="mt-2">
                  <BoardsNav boards={boards} />
                </div>
              </div>
              {projectData.permissions.canEdit ? (
                <div className="mt-6 pb-6 pl-6">
                  <h2 className="mx-2 text-sm font-bold text-muted-foreground">Options</h2>
                  <div className="mt-2">
                    <FeedbackOptions />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4 py-8 md:col-span-9">
          <div className="flex items-start gap-3 border-b pt-6 pb-6 md:-mr-8.25">
            <ArchivePencil className="mt-1 text-muted-foreground" size="28px" />
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-bold">Feedback</h1>
              <p className="text-muted-foreground">Share your ideas and help us improve.</p>
            </div>
          </div>
          <FeedbackToolbar />
          <div aria-busy={loadingFeedback} aria-live="polite">
            {feedback.length === 0 ? (
              <Notice icon={<Missing aria-hidden="true" size="32px" />}>No feedback found.</Notice>
            ) : null}
            {feedback.length > 0 ? (
              <ul className={cn('flex flex-col gap-4', loadingFeedback && 'pointer-events-none opacity-50')}>
                {feedback.map((item) => (
                  <FeedbackCard
                    key={item.id}
                    feedback={item}
                    isAuthenticated={!!profileQuery.data}
                    onNavigationClick={() =>
                      router.navigate({
                        params: { org: orgSlug, project: projectSlug, slug: item.slug },
                        to: '/@{$org}/$project/feedback/$slug',
                      })
                    }
                  />
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
