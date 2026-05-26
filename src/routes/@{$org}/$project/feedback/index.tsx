import type { ReactNode } from "react"

import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
} from "@tanstack/react-router"
import { useInfiniteQuery } from "kitcn/react"
import { z } from "zod"

import { RoutePending } from "@/components/route-pending"
import { Button } from "@/components/ui/button"
import ArchivePencil from "@/icons/archive-pencil"
import CirclePlusOutline from "@/icons/circle-plus-outline"
import Missing from "@/icons/missing"
import { useCRPC } from "@/lib/convex/crpc"
import { crpcOptions } from "@/lib/convex/crpc-options"
import {
  fetchConvexLoaderQuery,
  prefetchConvexLoaderQuery,
} from "@/lib/convex/server"
import { cn } from "@/lib/utils"

import { BoardsNav } from "./-components/boards-nav"
import { FeedbackCard } from "./-components/feedback-card"
import { FeedbackOptions } from "./-components/feedback-options"
import { FeedbackToolbar } from "./-components/feedback-toolbar"

const NUM_OF_ITEMS_PER_PAGE = 50

type BoardSummary = {
  id: string
  slug: string
}

type ProjectDetailsData = {
  project?: {
    id: string
  } | null
}

const feedbackSearchParams = z.object({
  board: z.optional(z.string()).default("all"),
  search: z.optional(
    z.string().transform((value) => (value?.trim() === "" ? undefined : value))
  ),
  status: z.optional(
    z
      .enum(["open", "in-progress", "closed", "completed", "paused"])
      .transform((value) => (value?.trim() === "" ? undefined : value))
  ),
})

export const Route = createFileRoute("/@{$org}/$project/feedback/")({
  component: FeedbackListRoute,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps, params }) => {
    const projectData = await fetchConvexLoaderQuery<ProjectDetailsData | null>(
      context.queryClient,
      crpcOptions.project.getDetails.staticQueryOptions({
        orgSlug: params.org,
        slug: params.project,
      }),
      context.loaderToken
    )

    if (!projectData?.project) {
      throw notFound()
    }

    const boards = await fetchConvexLoaderQuery<BoardSummary[] | null>(
      context.queryClient,
      crpcOptions.feedbackBoard.listProjectBoards.staticQueryOptions({
        projectId: projectData.project.id,
      }),
      context.loaderToken
    )
    const boardId = getBoardId(boards, deps.board)

    await Promise.all([
      prefetchConvexLoaderQuery(
        context.queryClient,
        crpcOptions.feedback.listProjectFeedback.staticQueryOptions({
          boardId,
          cursor: null,
          limit: NUM_OF_ITEMS_PER_PAGE,
          projectId: projectData.project.id,
          search: deps.search,
          status: deps.status,
        }),
        context.loaderToken
      ),
      prefetchConvexLoaderQuery(
        context.queryClient,
        crpcOptions.profile.findMyProfile.staticQueryOptions(
          {},
          { skipUnauth: true }
        ),
        context.loaderToken
      ),
    ])
  },
  pendingComponent: () => <RoutePending variant="sidebar" />,
  pendingMs: 600,
  validateSearch: feedbackSearchParams,
})

function getBoardId(
  boards: BoardSummary[] | null | undefined,
  boardSlug: string | undefined
) {
  return boards?.find((item) => item.slug === boardSlug)?.id ?? "all"
}

function Notice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="text-bold flex items-center justify-center gap-3 rounded-lg border bg-muted p-4 text-xl text-muted-foreground md:p-10">
      <div>{icon}</div>
      <div>{children}</div>
    </div>
  )
}

function FeedbackListRoute() {
  const router = useRouter()
  const searchParams = Route.useSearch()
  const { search, status, board } = searchParams
  const { org: orgSlug, project: projectSlug } = Route.useParams()
  const crpc = useCRPC()

  const { data: projectData } = useSuspenseQuery(
    crpc.project.getDetails.queryOptions({
      orgSlug,
      slug: projectSlug,
    })
  )

  if (!projectData?.project) {
    throw notFound()
  }

  const { data: boards } = useSuspenseQuery(
    crpc.feedbackBoard.listProjectBoards.queryOptions({
      projectId: projectData.project.id,
    })
  )
  const profileQuery = useQuery(
    crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
  )
  const boardId = getBoardId(boards, board)
  const feedbackQuery = useInfiniteQuery(
    crpc.feedback.listProjectFeedback.infiniteQueryOptions(
      {
        boardId,
        projectId: projectData.project.id,
        search,
        status,
      },
      {
        limit: NUM_OF_ITEMS_PER_PAGE,
      }
    )
  )

  const loadingFeedback = feedbackQuery.isFetching
  const loadingMoreFeedback = feedbackQuery.status === "LoadingMore"
  const feedback = feedbackQuery.data ?? []
  const initialFeedbackLoading =
    feedbackQuery.status === "LoadingFirstPage" && feedback.length === 0

  return (
    <div className="container h-full overflow-visible">
      <div className="h-full grid-cols-12 gap-8 md:grid">
        <div className="order-first border-l border-border/75 py-6 md:order-last md:col-span-3">
          <div className="sticky top-6 flex flex-col overflow-hidden">
            <div className="border-b pb-6 pl-6">
              <Button asChild className="w-full" size="lg">
                <Link
                  params={{ org: orgSlug, project: projectSlug }}
                  to="/@{$org}/$project/feedback/new"
                >
                  <CirclePlusOutline size="16px" /> Add feedback
                </Link>
              </Button>
            </div>
            <div className="mt-4">
              <div className="border-b pb-6 pl-6">
                <h2 className="mx-2 text-sm font-bold text-muted-foreground">
                  Boards
                </h2>
                <div className="mt-2">
                  <BoardsNav boards={boards} />
                </div>
              </div>
              {projectData.permissions.canEdit ? (
                <div className="mt-6 pb-6 pl-6">
                  <h2 className="mx-2 text-sm font-bold text-muted-foreground">
                    Options
                  </h2>
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
              <p className="text-muted-foreground">
                Share your ideas and help us improve.
              </p>
            </div>
          </div>
          <FeedbackToolbar />
          <div aria-busy={loadingFeedback} aria-live="polite">
            {initialFeedbackLoading ? <FeedbackListSkeleton /> : null}
            {!initialFeedbackLoading && feedback.length === 0 ? (
              <Notice icon={<Missing aria-hidden="true" size="32px" />}>
                No feedback found.
              </Notice>
            ) : null}
            {!initialFeedbackLoading && feedback.length > 0 ? (
              <ul
                className={cn(
                  "flex flex-col gap-4",
                  loadingFeedback && "pointer-events-none opacity-50"
                )}
              >
                {feedback.map((item) => (
                  <FeedbackCard
                    key={item.id}
                    feedback={item}
                    isAuthenticated={!!profileQuery.data}
                    onNavigationClick={() =>
                      router.navigate({
                        params: {
                          org: orgSlug,
                          project: projectSlug,
                          slug: item.slug,
                        },
                        to: "/@{$org}/$project/feedback/$slug",
                      })
                    }
                  />
                ))}
              </ul>
            ) : null}
          </div>
          {feedbackQuery.status === "CanLoadMore" ? (
            <div className="flex items-center gap-3">
              <Button
                disabled={loadingMoreFeedback}
                onClick={() =>
                  feedbackQuery.fetchNextPage(NUM_OF_ITEMS_PER_PAGE)
                }
                variant="outline"
              >
                {loadingMoreFeedback
                  ? "Loading feedback..."
                  : "Load more feedback"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function FeedbackListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div className="rounded-xl border bg-card p-4" key={index}>
          <div className="flex gap-4">
            <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
            <div className="flex flex-1 flex-col gap-3">
              <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
