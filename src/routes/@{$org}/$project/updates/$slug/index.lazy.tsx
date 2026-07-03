import { useMemo, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useAuth } from "kitcn/react"
import {
  createLazyFileRoute,
  getRouteApi,
  Link,
  notFound,
} from "@tanstack/react-router"
import {
  Calendar,
  Check,
  Edit,
  Heart,
  Info,
  Link as LinkIcon,
  Link2,
  MessageSquare,
  Rss,
  Users,
} from "lucide-react"

import { EditorContentDisplay } from "@/components/editor"
import { ProfileLinkOrUnknown } from "@/components/profile-link"
import { SidebarSection } from "@/components/sidebar-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useCRPC } from "@/lib/convex/crpc"
import { useSidebarState } from "@/lib/hooks/use-sidebar-state"
import { cn } from "@/lib/utils"
import { formatFullDate, formatRelativeDay } from "@/lib/utils/format-timestamp"
import { StatusIcon } from "@/icons"

import { CategoryBadge } from "../-components/category-badge"
import {
  CommentEditorProvider,
  CommentForm,
  CommentList,
  type ThreadComment,
} from "../../-components/comment-thread"

import { useEmoteToggle } from "../-components/use-emote-toggle"

const SIDEBAR_STORAGE_KEY = "update-detail-sidebar-state"

const DEFAULT_SIDEBAR_STATE = {
  details: true,
  related: true,
}

const routeApi = getRouteApi("/@{$org}/$project/updates/$slug/")

type UpdateCommentData = ThreadComment & {
  isTeamMember?: boolean
}

type MiddleCommentState<TComment> = {
  comments: TComment[]
  cursor: string | null
  key: string
  pageCount: number
}

function dedupeUpdateComments(comments: UpdateCommentData[]) {
  const seen = new Set<string>()
  return comments.filter((comment) => {
    if (seen.has(comment.id)) return false
    seen.add(comment.id)
    return true
  })
}

function createMiddleCommentState<TComment>(
  key: string,
  cursor: string | null
): MiddleCommentState<TComment> {
  return {
    comments: [],
    cursor,
    key,
    pageCount: 0,
  }
}

export const Route = createLazyFileRoute("/@{$org}/$project/updates/$slug/")({
  component: UpdateDetailRoute,
})

function UpdateDetailRoute() {
  const params = routeApi.useParams()
  const crpc = useCRPC()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [isLoadingMiddleComments, setIsLoadingMiddleComments] = useState(false)
  const { state: sidebarState, setSection: setSidebarSection } =
    useSidebarState(SIDEBAR_STORAGE_KEY, DEFAULT_SIDEBAR_STATE)

  const { data: projectData } = useSuspenseQuery(
    crpc.project.getDetails.queryOptions({
      orgSlug: params.org,
      slug: params.project,
    })
  )

  if (!projectData?.project?.id) {
    throw notFound()
  }

  const { data: updateData } = useSuspenseQuery(
    crpc.update.getDetailCritical.queryOptions({
      projectId: projectData.project.id,
      slug: params.slug,
    })
  )

  if (!updateData?.update) {
    throw notFound()
  }

  const interactiveQuery = useQuery(
    crpc.update.getDetailInteractive.queryOptions(
      {
        updateId: updateData.update.id,
        projectId: projectData.project.id,
      },
      { enabled: !!updateData.update.id }
    )
  )

  const commentMutation = useMutation(
    crpc.updateComment.create.mutationOptions()
  )
  const commentUpdateMutation = useMutation(
    crpc.updateComment.update.mutationOptions({
      onSuccess: () => {
        void revalidateMiddleComments()
      },
    })
  )
  const commentDeleteMutation = useMutation(
    crpc.updateComment.remove.mutationOptions({
      onSuccess: () => {
        void revalidateMiddleComments()
      },
    })
  )
  const commentEmoteMutation = useMutation(
    crpc.updateCommentEmote.toggle.mutationOptions({
      onSuccess: () => {
        void revalidateMiddleComments()
      },
    })
  )

  const update = updateData.update
  const middleStateKey = `${update.id}:${updateData.commentWindow.middleCursor ?? ""}`
  const initialMiddleState = () =>
    createMiddleCommentState<UpdateCommentData>(
      middleStateKey,
      updateData.commentWindow.middleCursor
    )
  const [middleState, setMiddleState] =
    useState<MiddleCommentState<UpdateCommentData>>(initialMiddleState)
  // When the update or server middle-cursor changes, `middleStateKey` changes
  // and this render derives a fresh (collapsed) snapshot instead of resetting
  // via an effect. The STORED `middleState` is not rewritten here — it keeps its
  // old key/comments until the next `updateMiddleState`, which re-bases onto a
  // fresh initial when it sees a stale key. Always read the snapshot through
  // `activeMiddleState`; reading `middleState` directly can surface a previous
  // update's comments after navigation.
  const activeMiddleState =
    middleState.key === middleStateKey ? middleState : initialMiddleState()
  const middleComments = activeMiddleState.comments
  const middleCursor = activeMiddleState.cursor
  // How many middle pages the viewer has expanded. Middle pages are a snapshot
  // (not a live subscription) to avoid holding a subscription open over a long
  // thread; we track the count so we can re-fetch exactly the expanded range
  // when the viewer mutates a comment. A hard refresh or navigating away and
  // back remounts this component, which re-initializes the snapshot (collapsed)
  // and re-reads the live head/tail — so those paths are always fresh.
  const middlePageCount = activeMiddleState.pageCount
  const updateMiddleState = (
    updater: (
      current: MiddleCommentState<UpdateCommentData>
    ) => MiddleCommentState<UpdateCommentData>
  ) => {
    setMiddleState((current) =>
      updater(current.key === middleStateKey ? current : initialMiddleState())
    )
  }
  const tailCommentIds = updateData.commentWindow.tailCommentIds.map(String)
  const interactiveData = interactiveQuery.data
  const currentProfile = interactiveData?.currentProfile
  const comments = useMemo(
    () =>
      dedupeUpdateComments([
        ...updateData.commentWindow.head,
        ...middleComments,
        ...updateData.commentWindow.tail,
      ] as UpdateCommentData[]),
    [
      middleComments,
      updateData.commentWindow.head,
      updateData.commentWindow.tail,
    ]
  )

  const heartData =
    interactiveData?.emoteCounts?.heart ?? updateData.emoteCounts?.heart
  const serverLikeCount = heartData?.count ?? 0
  const serverIsLiked = currentProfile
    ? Boolean(heartData?.authorProfileIds?.includes(currentProfile.id))
    : false
  const [copied, setCopied] = useState(false)

  const { isLiked, likeCount, isAnimating, toggle } = useEmoteToggle({
    updateId: update.id,
    serverIsLiked,
    serverLikeCount,
    canInteract: Boolean(currentProfile),
  })

  const relatedFeedback = interactiveData?.relatedFeedback ?? []
  const hasRelatedFeedback = relatedFeedback.length > 0
  const isAuthenticated =
    !!currentProfile || auth.hasSession || auth.isAuthenticated
  const rssUrl = `/@${params.org}/${params.project}/updates/rss.xml`

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleShareTwitter() {
    const url = encodeURIComponent(window.location.href)
    const text = encodeURIComponent(update.title)
    window.open(
      `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
      "_blank"
    )
  }

  async function handleLoadMiddleComments() {
    if (!middleCursor || isLoadingMiddleComments) return

    try {
      setIsLoadingMiddleComments(true)
      const result = await queryClient.fetchQuery(
        crpc.update.getMiddleComments.staticQueryOptions({
          cursor: middleCursor,
          tailCommentIds,
          updateId: update.id,
        })
      )
      updateMiddleState((current) => ({
        ...current,
        comments: dedupeUpdateComments([
          ...current.comments,
          ...((result?.comments ?? []) as UpdateCommentData[]),
        ]),
        cursor: result?.nextCursor ?? null,
        pageCount: current.pageCount + 1,
      }))
    } finally {
      setIsLoadingMiddleComments(false)
    }
  }

  // Re-fetch exactly the middle pages the viewer has expanded, forcing a fresh
  // network read so a comment they just edited/deleted/reacted to is reflected.
  // No-op when nothing in the middle is expanded.
  async function revalidateMiddleComments() {
    const startCursor = updateData?.commentWindow.middleCursor
    if (!startCursor || middlePageCount === 0) return

    let cursor: string | null = startCursor
    let nextCursor: string | null = null
    const refreshed: UpdateCommentData[] = []

    for (let page = 0; page < middlePageCount && cursor; page++) {
      const options = crpc.update.getMiddleComments.staticQueryOptions({
        cursor,
        tailCommentIds,
        updateId: update.id,
      })
      await queryClient.invalidateQueries({ queryKey: options.queryKey })
      const result = await queryClient.fetchQuery(options)
      refreshed.push(...((result?.comments ?? []) as UpdateCommentData[]))
      nextCursor = result?.nextCursor ?? null
      cursor = nextCursor
    }

    updateMiddleState((current) => ({
      ...current,
      comments: dedupeUpdateComments(refreshed),
      cursor: nextCursor,
    }))
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b">
        <div className="container flex items-start gap-4 pt-10 pb-6">
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              {update.status === "draft" ? (
                <Badge
                  className="text-yellow-600 dark:text-yellow-400"
                  variant="outline"
                >
                  Draft
                </Badge>
              ) : null}
              {update.category ? (
                <CategoryBadge category={update.category} />
              ) : null}
            </div>
            <h1 className="text-3xl font-bold">{update.title}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {updateData.author ? (
                <Link
                  className="flex items-center gap-2 hover:underline"
                  params={{ username: updateData.author.username }}
                  to="/u/$username"
                >
                  {updateData.author.imageUrl ? (
                    <img
                      alt={updateData.author.username}
                      className="h-5 w-5 rounded-full"
                      src={updateData.author.imageUrl}
                    />
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {updateData.author.name?.charAt(0) ?? "?"}
                    </div>
                  )}
                  <span>@{updateData.author.username}</span>
                </Link>
              ) : null}
              {update.publishedAt ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex cursor-pointer items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span suppressHydrationWarning>
                        {formatRelativeDay(Number(update.publishedAt))}
                      </span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span suppressHydrationWarning>
                      {formatFullDate(Number(update.publishedAt))}
                    </span>
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              className={cn(
                "group gap-2",
                isLiked
                  ? "text-red-500 hover:bg-red-500/10 hover:text-red-600"
                  : "text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
              )}
              disabled={!currentProfile}
              onClick={toggle}
              variant="ghost"
            >
              <Heart
                className={cn(
                  "size-4 transition-transform duration-200",
                  isLiked && "fill-current",
                  currentProfile && "group-hover:scale-110",
                  isAnimating && "animate-[heart-pop_0.6s_ease-out]"
                )}
              />
              <span className="font-medium">
                {likeCount} {likeCount === 1 ? "like" : "likes"}
              </span>
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleCopyLink} size="icon" variant="ghost">
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Link2 className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {copied ? "Copied!" : "Copy link"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleShareTwitter}
                  size="icon"
                  variant="ghost"
                >
                  <svg
                    className="size-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share on X</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild size="icon" variant="ghost">
                  <a href={rssUrl}>
                    <Rss className="size-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>RSS Feed</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
      <div className="container flex flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-8 md:grid md:grid-cols-12">
          <div className="order-last py-8 md:col-span-4 md:border-l md:border-border/75">
            <div className="sticky top-4 flex flex-col gap-6 md:pl-8">
              <SidebarSection
                icon={<Info className="size-3.5" />}
                onOpenChange={(open) => setSidebarSection("details", open)}
                open={sidebarState.details}
                title="Details"
              >
                <div className="flex flex-col">
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-muted-foreground">
                      Published
                    </span>
                    <span className="text-sm">
                      {update.status === "draft" ? (
                        <span className="text-yellow-600 dark:text-yellow-400">
                          Draft
                        </span>
                      ) : update.publishedAt ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="cursor-pointer"
                              suppressHydrationWarning
                            >
                              {formatRelativeDay(Number(update.publishedAt))}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <span suppressHydrationWarning>
                              {formatFullDate(Number(update.publishedAt))}
                            </span>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        "Not published"
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-muted-foreground">
                      Author
                    </span>
                    <ProfileLinkOrUnknown profile={updateData.author} showAt />
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-muted-foreground">
                      Category
                    </span>
                    <CategoryBadge category={update.category} />
                  </div>
                </div>
              </SidebarSection>

              {hasRelatedFeedback ? (
                <SidebarSection
                  icon={<LinkIcon className="size-3.5" />}
                  onOpenChange={(open) => setSidebarSection("related", open)}
                  open={sidebarState.related}
                  title="Related Feedback"
                >
                  <div className="flex flex-col">
                    {relatedFeedback.map((item) => (
                      <Link
                        className="flex cursor-pointer items-center gap-2.5 rounded-md py-2 transition-colors hover:bg-muted/50"
                        key={item.id}
                        params={{
                          org: params.org,
                          project: params.project,
                          slug: item.slug,
                        }}
                        to="/@{$org}/$project/feedback/$slug"
                      >
                        <StatusIcon colored size="14" status={item.status} />
                        <span className="flex-1 truncate text-sm">
                          {item.title}
                        </span>
                      </Link>
                    ))}
                  </div>
                </SidebarSection>
              ) : null}

              {interactiveData?.canEdit ? (
                <Button asChild variant="outline">
                  <Link
                    params={params}
                    to="/@{$org}/$project/updates/$slug/edit"
                  >
                    <Edit className="h-4 w-4" />
                    Edit Update
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-4 py-8 md:col-span-8">
            {updateData.coverImageUrl ? (
              <img
                alt={update.title}
                className="w-full rounded-lg bg-muted object-cover"
                src={updateData.coverImageUrl}
              />
            ) : null}

            <div className="prose-lg">
              <EditorContentDisplay content={update.content} />
            </div>

            <div className="mt-8 border-t pt-8">
              <CommentEditorProvider>
                <div className="mb-4 flex w-full items-center border-b pb-2">
                  <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    <MessageSquare className="size-3.5" />
                    Discussion
                  </h2>
                </div>
                <CommentList
                  comments={comments}
                  currentProfileId={currentProfile?.id}
                  getBadges={(comment) =>
                    (comment as ThreadComment & { isTeamMember?: boolean })
                      .isTeamMember ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        <Users className="h-3 w-3" />
                        Team
                      </span>
                    ) : null
                  }
                  isDeleting={commentDeleteMutation.isPending}
                  isUpdating={commentUpdateMutation.isPending}
                  onDelete={(commentId) =>
                    commentDeleteMutation.mutate({ _id: commentId })
                  }
                  onToggleEmote={(commentId, content) =>
                    commentEmoteMutation.mutate({
                      content,
                      updateCommentId: commentId,
                      updateId: update.id,
                    })
                  }
                  onUpdate={(commentId, content) =>
                    commentUpdateMutation.mutateAsync({
                      _id: commentId,
                      content,
                    })
                  }
                />
                {middleCursor ? (
                  <div className="mt-6 flex justify-center">
                    <Button
                      disabled={isLoadingMiddleComments}
                      onClick={handleLoadMiddleComments}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {isLoadingMiddleComments
                        ? "Loading comments..."
                        : "Show more comments"}
                    </Button>
                  </div>
                ) : null}
                <CommentForm
                  isAuthenticated={isAuthenticated}
                  isSubmitting={commentMutation.isPending}
                  onSubmit={async (content) => {
                    await commentMutation.mutateAsync({
                      content,
                      updateId: update.id,
                    })
                    await revalidateMiddleComments()
                  }}
                  redirectTo={`/@${params.org}/${params.project}/updates/${params.slug}`}
                />
              </CommentEditorProvider>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
