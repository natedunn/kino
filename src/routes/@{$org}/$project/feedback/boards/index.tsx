import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';

import {
  EmptyState,
} from '@/components/kino/common';
import { buttonVariants } from '@/components/ui/button';
import { Icon, type IconName } from '@/icons';
import Eye from '@/icons/eye';
import Pen from '@/icons/pen';
import VArrowRight from '@/icons/v-arrow-right';
import { useCRPC } from '@/lib/convex/crpc';

export const Route = createFileRoute('/@{$org}/$project/feedback/boards/')({
  component: BoardsIndexRoute,
});

function BoardsIndexRoute() {
  const params = Route.useParams();
  const crpc = useCRPC();

  const projectQuery = useQuery(
    crpc.project.getDetails.queryOptions({
      orgSlug: params.org,
      slug: params.project,
    })
  );
  const boardsQuery = useQuery(
    crpc.feedbackBoard.listProjectBoards.queryOptions(
      {
        projectId: projectQuery.data?.project?.id,
      },
      { enabled: !!projectQuery.data?.project?.id }
    )
  );

  const boards = boardsQuery.data ?? [];

  if (!projectQuery.data?.project && projectQuery.isLoading) {
    return <div className="h-48 animate-pulse rounded-lg bg-muted/40" />;
  }

  if (!projectQuery.data?.project || !projectQuery.data.permissions.canEdit) {
    return (
      <EmptyState
        title="Board management unavailable"
        description="Only project editors can manage feedback boards."
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="overflow-hidden border-b bg-muted/50 pt-12 pb-6">
        <div className="container relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative">
            <h1 className="relative z-10 flex flex-wrap items-center gap-2 text-2xl font-bold md:text-3xl">
              <span className="text-muted-foreground">Feedback</span>
              <VArrowRight className="text-muted-foreground" size="20px" /> Boards
            </h1>
            <h1 className="pointer-events-none absolute top-10 hidden scale-[2.5] text-3xl font-bold opacity-50 blur-xl select-none md:flex md:items-center md:gap-2">
              <span className="text-muted-foreground">Feedback</span>
              <VArrowRight className="text-muted-foreground" size="20px" /> Boards
            </h1>
          </div>
          <div className="relative inline-flex items-stretch justify-stretch">
            <Link
              className={buttonVariants({
                variant: 'default',
                className: 'relative z-10',
              })}
              params={params}
              to="/@{$org}/$project/feedback/boards/new"
            >
              Create board
            </Link>
            <div className="absolute inset-0 translate-y-10 scale-[2.5] bg-blue-500 opacity-20 blur-xl" />
          </div>
        </div>
      </div>
      <div className="container py-4">
        <div className="mt-8 grid grid-cols-12 gap-6">
          {boards.length === 0 ? (
            <div>No boards have been create yet.</div>
          ) : (
            boards.map((board) => (
              <div key={board.id} className="col-span-12 md:col-span-6">
                <div className="flex h-full flex-col justify-center gap-2 rounded-lg border bg-muted p-6">
                  <div className="flex items-start gap-6">
                    <div className="mt-1">
                      <Icon
                        fallback="box"
                        name={(board.icon as IconName | null) ?? 'box'}
                        size="32px"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-lg font-bold">{board.name}</span>
                      <span className="text-muted-foreground">
                        {board.description ?? (
                          <span className="opacity-50">No description added</span>
                        )}
                      </span>
                      <div className="mt-4 flex flex-wrap items-center gap-4">
                        <Link
                          className="link-text flex items-center gap-2"
                          params={{ ...params, board: board.id }}
                          to="/@{$org}/$project/feedback/boards/$board/edit"
                        >
                          <Pen className="text-muted-foreground" size="14px" />
                          Edit
                        </Link>
                        <Link
                          className="link-text flex items-center gap-2"
                          params={{ org: params.org, project: params.project }}
                          search={{ board: board.slug }}
                          to="/@{$org}/$project/feedback"
                        >
                          <Eye className="text-muted-foreground" size="14px" />
                          View
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
