import { useState, type ReactNode } from "react"

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
} from "@tanstack/react-router"
import { z } from "zod"

import { RoutePending } from "@/components/route-pending"
import { Button } from "@/components/ui/button"
import CirclePlusOutline from "@/icons/circle-plus-outline"
import Missing from "@/icons/missing"
import { useCRPC } from "@/lib/convex/crpc"
import { crpcServer } from "@/lib/convex/crpc-server"

import { BoardsNav } from "./-components/boards-nav"
import { FeedbackCard } from "./-components/feedback-card"
import { FeedbackOptions } from "./-components/feedback-options"
import { FeedbackToolbar } from "./-components/feedback-toolbar"

const NUM_OF_ITEMS_PER_PAGE = 50

type BoardSummary = {
  id: string
  slug: string
}

type FeedbackListArgs = {
  boardId: string
  cursor: string | null
  limit: number
  projectId: string
  search?: string
  status?: "open" | "in-progress" | "closed" | "completed" | "paused"
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
    const projectData = await context.queryClient.ensureQueryData(
      crpcServer.project.getDetails.queryOptions({
        orgSlug: params.org,
        slug: params.project,
      })
    )

    if (!projectData?.project) {
      throw notFound()
    }

    const boards = await context.queryClient.ensureQueryData(
      crpcServer.feedbackBoard.listProjectBoards.queryOptions({
        projectId: projectData.project.id,
      })
    )
    const boardId = getBoardId(boards, deps.board)

    await Promise.all([
      context.queryClient.ensureQueryData(
        crpcServer.feedback.listProjectFeedback.queryOptions(
          getFeedbackListArgs({
            boardId,
            cursor: null,
            projectId: projectData.project.id,
            search: deps.search,
            status: deps.status,
          })
        )
      ),
      context.queryClient.ensureQueryData(
        crpcServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
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

function getFeedbackListArgs({
  boardId,
  cursor,
  projectId,
  search,
  status,
}: Omit<FeedbackListArgs, "limit">): FeedbackListArgs {
  return {
    boardId,
    cursor,
    limit: NUM_OF_ITEMS_PER_PAGE,
    projectId,
    search,
    status,
  }
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
  const queryClient = useQueryClient()
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
  const projectId = projectData.project.id

  const { data: boards } = useSuspenseQuery(
    crpc.feedbackBoard.listProjectBoards.queryOptions({
      projectId,
    })
  )
  const profileQuery = useSuspenseQuery(
    crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
  )
  const boardId = getBoardId(boards, board)
  const firstFeedbackPageArgs = getFeedbackListArgs({
    boardId,
    cursor: null,
    projectId,
    search,
    status,
  })
  const firstFeedbackPageKey = JSON.stringify(firstFeedbackPageArgs)
  const { data: firstFeedbackPage, isFetching: refreshingFeedback } =
    useSuspenseQuery(
      crpc.feedback.listProjectFeedback.queryOptions(firstFeedbackPageArgs)
    )
  const [additionalFeedbackState, setAdditionalFeedbackState] = useState<{
    key: string
    pages: Array<typeof firstFeedbackPage>
  }>({
    key: firstFeedbackPageKey,
    pages: [],
  })
  const [loadingMoreFeedback, setLoadingMoreFeedback] = useState(false)
  const [loadMoreErrorState, setLoadMoreErrorState] = useState<{
    error: Error | null
    key: string
  }>({
    error: null,
    key: firstFeedbackPageKey,
  })

  const additionalFeedbackPages =
    additionalFeedbackState.key === firstFeedbackPageKey
      ? additionalFeedbackState.pages
      : []
  const loadMoreError =
    loadMoreErrorState.key === firstFeedbackPageKey
      ? loadMoreErrorState.error
      : null
  const feedbackPages = [firstFeedbackPage, ...additionalFeedbackPages]
  const lastFeedbackPage = additionalFeedbackPages.at(-1) ?? firstFeedbackPage
  const feedback = feedbackPages
    .flatMap((page) => page.page)
    .filter((item, index, items) => {
      return items.findIndex((candidate) => candidate.id === item.id) === index
    })
  const canLoadMoreFeedback =
    !lastFeedbackPage.isDone && !!lastFeedbackPage.continueCursor

  async function loadMoreFeedback() {
    if (!canLoadMoreFeedback || loadingMoreFeedback) return

    setLoadingMoreFeedback(true)
    setLoadMoreErrorState({ error: null, key: firstFeedbackPageKey })

    try {
      const nextPage = await queryClient.fetchQuery(
        crpc.feedback.listProjectFeedback.staticQueryOptions(
          getFeedbackListArgs({
            boardId,
            cursor: lastFeedbackPage.continueCursor,
            projectId,
            search,
            status,
          })
        )
      )
      setAdditionalFeedbackState((state) => ({
        key: firstFeedbackPageKey,
        pages:
          state.key === firstFeedbackPageKey
            ? [...state.pages, nextPage]
            : [nextPage],
      }))
    } catch (error) {
      setLoadMoreErrorState({
        error:
          error instanceof Error
            ? error
            : new Error("Failed to load more feedback"),
        key: firstFeedbackPageKey,
      })
    } finally {
      setLoadingMoreFeedback(false)
    }
  }

  return (
    <div className="container flex flex-1 flex-col overflow-visible">
      <div className="flex flex-1 flex-col gap-8 md:grid md:grid-cols-12">
        <div className="order-last py-8 md:order-first md:col-span-3 md:border-r md:border-border/75">
          <div className="sticky top-6 flex flex-col overflow-hidden">
            <div className="border-b pb-6 md:pr-6">
              <Button asChild className="w-full">
                <Link
                  params={{ org: orgSlug, project: projectSlug }}
                  to="/@{$org}/$project/feedback/new"
                >
                  <CirclePlusOutline size="16px" />
                  Add feedback
                  <kbd className="ml-1 rounded border border-current px-1.5 py-px text-xs opacity-50 font-sans">⌘O</kbd>
                </Link>
              </Button>
            </div>
            <div className="mt-4">
              <div className="border-b pb-6 md:pr-6">
                <h2 className="mx-2 text-sm font-bold text-muted-foreground">
                  Boards
                </h2>
                <div className="mt-2">
                  <BoardsNav boards={boards} />
                </div>
              </div>
              {projectData.permissions.canEdit ? (
                <div className="mt-6 pb-6 md:pr-6">
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
          <FeedbackToolbar />
          <div
            aria-busy={refreshingFeedback || loadingMoreFeedback}
            aria-live="polite"
          >
            {feedback.length === 0 ? (
              <Notice icon={<Missing aria-hidden="true" size="32px" />}>
                No feedback found.
              </Notice>
            ) : null}
            {feedback.length > 0 ? (
              <ul className="flex flex-col gap-4">
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
          {loadMoreError ? (
            <p className="text-sm text-destructive">{loadMoreError.message}</p>
          ) : null}
          {canLoadMoreFeedback ? (
            <div className="flex items-center gap-3">
              <Button
                disabled={loadingMoreFeedback}
                onClick={() => void loadMoreFeedback()}
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
