import { useEffect, useRef, useState } from "react"
import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, notFound } from "@tanstack/react-router"
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
import { RoutePending } from "@/components/route-pending"
import { SidebarSection } from "@/components/sidebar-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useCRPC } from "@/lib/convex/crpc"
import { crpcServer } from "@/lib/convex/crpc-server"
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
import { projectTitle, titleFromSlug, titleMeta } from "@/lib/seo"

const heartPopKeyframes = `
@keyframes heart-pop {
  0% { transform: scale(1); }
  15% { transform: scale(1.3); }
  30% { transform: scale(0.95); }
  45% { transform: scale(1.15); }
  60% { transform: scale(1); }
}
`

const SIDEBAR_STORAGE_KEY = "update-detail-sidebar-state"

const DEFAULT_SIDEBAR_STATE = {
  details: true,
  related: true,
}

export const Route = createFileRoute("/@{$org}/$project/updates/$slug/")({
  component: UpdateDetailRoute,
  loader: async ({ context, params }) => {
    const projectData = await context.queryClient.ensureQueryData(
      crpcServer.project.getDetails.queryOptions({
        orgSlug: params.org,
        slug: params.project,
      })
    )

    if (!projectData?.project?.id) {
      throw notFound()
    }

    const updateData = await context.queryClient.ensureQueryData(
      crpcServer.update.getBySlug.queryOptions({
        projectId: projectData.project.id,
        slug: params.slug,
      })
    )

    if (!updateData?.update) {
      throw notFound()
    }

    await Promise.all([
      context.queryClient.ensureQueryData(
        crpcServer.updateComment.listByUpdate.queryOptions({
          updateId: updateData.update.id,
        })
      ),
      context.queryClient.ensureQueryData(
        crpcServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
      ),
    ])

    return {
      title: updateData.update.title,
    }
  },
  head: ({ loaderData, params }) => ({
    meta: [
      titleMeta([
        loaderData?.title ?? titleFromSlug(params.slug),
        projectTitle(params.org, params.project),
      ]),
    ],
  }),
  pendingComponent: () => <RoutePending variant="detail" />,
  pendingMs: 600,
})

function UpdateDetailRoute() {
  const params = Route.useParams()
  const crpc = useCRPC()
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

  const profileQuery = useSuspenseQuery(
    crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
  )
  const { data: updateData } = useSuspenseQuery(
    crpc.update.getBySlug.queryOptions({
      projectId: projectData.project.id,
      slug: params.slug,
    })
  )

  if (!updateData?.update) {
    throw notFound()
  }

  const { data: comments } = useSuspenseQuery(
    crpc.updateComment.listByUpdate.queryOptions({
      updateId: updateData.update.id,
    })
  )

  const toggleEmote = useMutation(crpc.updateEmote.toggle.mutationOptions())
  const commentMutation = useMutation(
    crpc.updateComment.create.mutationOptions()
  )
  const commentUpdateMutation = useMutation(
    crpc.updateComment.update.mutationOptions()
  )
  const commentDeleteMutation = useMutation(
    crpc.updateComment.remove.mutationOptions()
  )
  const commentEmoteMutation = useMutation(
    crpc.updateCommentEmote.toggle.mutationOptions()
  )

  const currentProfile = profileQuery.data
  const update = updateData.update

  const heartData = updateData?.emoteCounts?.heart
  const serverLikeCount = heartData?.count ?? 0
  const serverIsLiked = currentProfile
    ? heartData?.authorProfileIds?.includes(currentProfile.id)
    : false
  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null)
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [copied, setCopied] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingStateRef = useRef<boolean | null>(null)
  const prevLikedRef = useRef(serverIsLiked)

  const isLiked = optimisticLiked ?? serverIsLiked
  const likeCount = optimisticCount ?? serverLikeCount

  useEffect(() => {
    if (optimisticLiked !== null && serverIsLiked === optimisticLiked) {
      setOptimisticLiked(null)
      setOptimisticCount(null)
    }
  }, [optimisticLiked, serverIsLiked])

  useEffect(() => {
    if (isLiked && !prevLikedRef.current) {
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 600)
      return () => clearTimeout(timer)
    }
    prevLikedRef.current = isLiked
  }, [isLiked])

  const hasRelatedFeedback = updateData.relatedFeedback.length > 0
  const isAuthenticated = !!currentProfile
  const rssUrl = `/@${params.org}/${params.project}/updates/rss.xml`

  function handleLike() {
    if (!currentProfile || !update) return

    const newIsLiked = !isLiked
    const newCount = newIsLiked ? likeCount + 1 : Math.max(0, likeCount - 1)
    setOptimisticLiked(newIsLiked)
    setOptimisticCount(newCount)
    pendingStateRef.current = newIsLiked

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (pendingStateRef.current !== serverIsLiked) {
        toggleEmote.mutate({ content: "heart", updateId: update.id })
      } else {
        setOptimisticLiked(null)
        setOptimisticCount(null)
      }
      pendingStateRef.current = null
    }, 300)
  }

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
              onClick={handleLike}
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
          <style>{heartPopKeyframes}</style>

          <SidebarSection
            icon={<Info className="size-3.5" />}
            onOpenChange={(open) => setSidebarSection("details", open)}
            open={sidebarState.details}
            title="Details"
          >
            <div className="flex flex-col">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-muted-foreground">Published</span>
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
                <span className="text-sm text-muted-foreground">Author</span>
                <ProfileLinkOrUnknown profile={updateData.author} showAt />
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-muted-foreground">Category</span>
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
                {updateData.relatedFeedback.map((item) => (
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

          {updateData.canEdit ? (
            <Button asChild variant="outline">
              <Link params={params} to="/@{$org}/$project/updates/$slug/edit">
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
              comments={comments as ThreadComment[]}
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
            <CommentForm
              isAuthenticated={isAuthenticated}
              isSubmitting={commentMutation.isPending}
              onSubmit={async (content) => {
                await commentMutation.mutateAsync({
                  content,
                  updateId: update.id,
                })
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
