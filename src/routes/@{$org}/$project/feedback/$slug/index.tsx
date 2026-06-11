import {
  ArrowRightLeft,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleX,
  FolderInput,
  Info,
  Link as LinkIcon,
  MessageSquare,
  Plus,
  Tag,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react"
import { useMemo } from "react"
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, notFound } from "@tanstack/react-router"

import { ProfileLinkOrUnknown } from "@/components/profile-link"
import { RoutePending } from "@/components/route-pending"
import { SidebarSection } from "@/components/sidebar-section"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { StatusIcon } from "@/icons"
import { useCRPC } from "@/lib/convex/crpc"
import { crpcServer } from "@/lib/convex/crpc-server"
import { useSidebarState } from "@/lib/hooks/use-sidebar-state"
import { cn } from "@/lib/utils"
import {
  formatFullDate,
  formatRelativeDay,
  formatTimestamp,
} from "@/lib/utils/format-timestamp"

import { UpvoteButton } from "../-components/upvote-button"
import {
  CommentEditorProvider,
  CommentCard,
  CommentForm,
  type ThreadComment,
} from "../../-components/comment-thread"

const SIDEBAR_STORAGE_KEY = "feedback-detail-sidebar-state"

const DEFAULT_SIDEBAR_STATE = {
  details: true,
  labels: true,
  people: true,
  related: true,
}

const FEEDBACK_STATUS_OPTIONS = [
  { label: "Open", value: "open" },
  { label: "In progress", value: "in-progress" },
  { label: "Paused", value: "paused" },
  { label: "Completed", value: "completed" },
  { label: "Closed", value: "closed" },
] as const

type ProfileSummary = {
  id?: string
  imageUrl?: string | null
  name?: string | null
  username: string
}

type FeedbackCommentData = {
  author: ProfileSummary | null
  content: string
  createdAt: number | string | Date
  emoteCounts?: Record<string, { authorProfileIds: string[]; count: number }>
  id: string
  initial?: boolean
  isTeamMember?: boolean
  updatedTime?: number | string | Date | null
}

type FeedbackEventData = {
  actor?: ProfileSummary | null
  createdAt: number | string | Date
  eventType:
    | "answer_marked"
    | "answer_unmarked"
    | "assigned"
    | "board_changed"
    | "status_changed"
    | "title_changed"
    | "unassigned"
    | string
  id: string
  metadata?: {
    newValue?: string | null
    oldValue?: string | null
  } | null
  targetProfile?: ProfileSummary | null
}

export const Route = createFileRoute("/@{$org}/$project/feedback/$slug/")({
  component: FeedbackDetailRoute,
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

    const feedbackData = await context.queryClient.ensureQueryData(
      crpcServer.feedback.getBySlug.queryOptions({
        projectId: projectData.project.id,
        slug: params.slug,
      })
    )

    if (!feedbackData?.feedback) {
      throw notFound()
    }

    await Promise.all([
      context.queryClient.ensureQueryData(
        crpcServer.feedbackComment.listByFeedback.queryOptions({
          feedbackId: feedbackData.feedback.id,
        })
      ),
      context.queryClient.ensureQueryData(
        crpcServer.feedbackEvent.listByFeedback.queryOptions({
          feedbackId: feedbackData.feedback.id,
        })
      ),
      context.queryClient.ensureQueryData(
        crpcServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
      ),
      context.queryClient.ensureQueryData(
        crpcServer.feedbackBoard.listProjectBoards.queryOptions({
          projectId: projectData.project.id,
        })
      ),
      projectData.permissions.canEdit
        ? context.queryClient.ensureQueryData(
            crpcServer.projectMember.listAssignableMembers.queryOptions(
              {
                projectId: projectData.project.id,
              },
              { skipUnauth: true }
            )
          )
        : Promise.resolve(null),
    ])
  },
  pendingComponent: () => <RoutePending variant="detail" />,
  pendingMs: 600,
})

function FeedbackDetailRoute() {
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

  const { data: feedbackData } = useSuspenseQuery(
    crpc.feedback.getBySlug.queryOptions({
      projectId: projectData.project.id,
      slug: params.slug,
    })
  )

  if (!feedbackData?.feedback) {
    throw notFound()
  }

  const feedback = feedbackData.feedback
  const { data: comments } = useSuspenseQuery(
    crpc.feedbackComment.listByFeedback.queryOptions({
      feedbackId: feedback.id,
    })
  )
  const { data: events } = useSuspenseQuery(
    crpc.feedbackEvent.listByFeedback.queryOptions({
      feedbackId: feedback.id,
    })
  )
  const profileQuery = useSuspenseQuery(
    crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
  )
  const boardsQuery = useQuery(
    crpc.feedbackBoard.listProjectBoards.queryOptions({
      projectId: projectData.project.id,
    })
  )
  const assignableQuery = useQuery(
    crpc.projectMember.listAssignableMembers.queryOptions(
      {
        projectId: projectData.project.id,
      },
      { enabled: !!projectData.permissions.canEdit, skipUnauth: true }
    )
  )

  const currentProfile = profileQuery.data
  const isAuthenticated = !!currentProfile
  const canEditStatus =
    feedback.authorProfileId === currentProfile?.id ||
    projectData.permissions.canEdit
  const canMarkAnswer =
    feedback.authorProfileId === currentProfile?.id ||
    projectData.projectMember?.role === "org:admin"
  const firstComment = feedbackData.firstComment
  const firstCommentWithEmotes = comments.find(
    (comment: FeedbackCommentData) => comment.id === firstComment?.id
  )
  const boardOptions = feedbackData.board
    ? [
        feedbackData.board,
        ...(boardsQuery.data ?? []).filter(
          (board: { id: string }) => board.id !== feedbackData.board?.id
        ),
      ]
    : (boardsQuery.data ?? [])
  const assigneeOptions = feedbackData.assignedProfile
    ? [
        {
          profile: feedbackData.assignedProfile,
          profileId: feedbackData.assignedProfile.id,
        },
        ...(assignableQuery.data ?? []).filter(
          (member: { profileId: string }) =>
            member.profileId !== feedbackData.assignedProfile?.id
        ),
      ]
    : (assignableQuery.data ?? [])
  const statusSelectItems = FEEDBACK_STATUS_OPTIONS.map((status) => ({
    label: (
      <span className="inline-flex items-center gap-1.5">
        <StatusIcon colored size="14" status={status.value} />
        {status.label}
      </span>
    ),
    value: status.value,
  }))
  const boardSelectItems = boardOptions.map(
    (board: { id: string; name: string }) => ({
      label: board.name,
      value: board.id,
    })
  )
  const assigneeSelectItems = [
    { label: "Unassigned", value: "" },
    ...assigneeOptions.map(
      (member: { profile?: ProfileSummary | null; profileId: string }) => ({
        label: member.profile?.name ?? member.profile?.username ?? "Unknown",
        value: member.profileId,
      })
    ),
  ]

  const statusMutation = useMutation(
    crpc.feedback.updateStatus.mutationOptions()
  )
  const boardMutation = useMutation(crpc.feedback.updateBoard.mutationOptions())
  const assigneeMutation = useMutation(
    crpc.feedback.updateAssigned.mutationOptions()
  )
  const answerMutation = useMutation(
    crpc.feedback.setAnswerComment.mutationOptions()
  )
  const commentCreateMutation = useMutation(
    crpc.feedbackComment.create.mutationOptions()
  )
  const commentUpdateMutation = useMutation(
    crpc.feedbackComment.update.mutationOptions()
  )
  const commentDeleteMutation = useMutation(
    crpc.feedbackComment.remove.mutationOptions()
  )
  const commentEmoteMutation = useMutation(
    crpc.feedbackCommentEmote.toggle.mutationOptions()
  )

  const timelineItems = useMemo(
    () =>
      [
        ...comments
          .filter((comment: FeedbackCommentData) => !comment.initial)
          .map((comment: FeedbackCommentData) => ({
            createdAt: getTimestamp(comment.createdAt),
            data: comment,
            type: "comment" as const,
          })),
        ...events.map((event: FeedbackEventData) => ({
          createdAt: getTimestamp(event.createdAt),
          data: event,
          type: "event" as const,
        })),
      ].sort((a, b) => a.createdAt - b.createdAt),
    [comments, events]
  )

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b">
        <div className="container flex items-start gap-4 pt-10 pb-6">
          <div className="mt-1">
            <StatusIcon colored size="28" status={feedback.status} />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <h1 className="text-3xl">{feedback.title}</h1>
            <div className="text-sm text-muted-foreground">
              <span suppressHydrationWarning>
                {feedback.status === "open" ? "Opened" : "Updated"}{" "}
                {formatTimestamp(getTimestamp(feedback.createdAt))} ·{" "}
                {feedback.upvotes} upvote
                {feedback.upvotes !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <UpvoteButton
              feedbackId={feedback.id}
              initialCount={feedback.upvotes}
              initialHasUpvoted={feedbackData.hasUpvoted}
              isAuthenticated={isAuthenticated}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button className="size-8" size="icon" variant="ghost">
                  <Bell className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Subscribe to updates</TooltipContent>
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
                      Status
                    </span>
                    {canEditStatus ? (
                      <Select
                        items={statusSelectItems}
                        onValueChange={(value) =>
                          statusMutation.mutate({
                            id: feedback.id,
                            status: value as never,
                          })
                        }
                        value={feedback.status}
                      >
                        <SelectTrigger className="min-w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FEEDBACK_STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              <StatusIcon
                                colored
                                size="14"
                                status={status.value}
                              />
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <StatusIcon
                          colored
                          size="14"
                          status={feedback.status}
                        />
                        {feedback.status}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-muted-foreground">Board</span>
                    {canEditStatus ? (
                      <Select
                        items={boardSelectItems}
                        onValueChange={(value) =>
                          boardMutation.mutate({
                            boardId: value,
                            id: feedback.id,
                          })
                        }
                        value={feedback.boardId}
                      >
                        <SelectTrigger className="max-w-56 min-w-32">
                          <SelectValue placeholder="No board" />
                        </SelectTrigger>
                        <SelectContent>
                          {boardOptions.map(
                            (board: { id: string; name: string }) => (
                              <SelectItem key={board.id} value={board.id}>
                                {board.name}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm">
                        {feedbackData.board?.name ?? "No board"}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-muted-foreground">
                      Priority
                    </span>
                    <Button
                      className="h-auto gap-1.5 px-2 py-1 text-xs"
                      size="sm"
                      variant="outline"
                    >
                      <span className="size-2 rounded-full bg-amber-500" />
                      Medium
                      <ChevronDown size={12} />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-muted-foreground">
                      Due date
                    </span>
                    <Button
                      className="h-auto px-2 py-1 text-xs text-muted-foreground"
                      size="sm"
                      variant="ghost"
                    >
                      <Calendar className="mr-1.5 size-3" />
                      Set date
                    </Button>
                  </div>
                </div>
              </SidebarSection>

              <SidebarSection
                icon={<Users className="size-3.5" />}
                onOpenChange={(open) => setSidebarSection("people", open)}
                open={sidebarState.people}
                title="People"
              >
                <div className="flex flex-col">
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-muted-foreground">
                      Assignee
                    </span>
                    {canEditStatus ? (
                      <Select
                        items={assigneeSelectItems}
                        onValueChange={(value) =>
                          assigneeMutation.mutate({
                            assignedProfileId: value || null,
                            feedbackId: feedback.id,
                          })
                        }
                        value={feedback.assignedProfileId ?? ""}
                      >
                        <SelectTrigger className="max-w-48 min-w-32">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Unassigned</SelectItem>
                          {assigneeOptions.map(
                            (member: {
                              profile?: ProfileSummary | null
                              profileId: string
                            }) => (
                              <SelectItem
                                key={member.profileId}
                                value={member.profileId}
                              >
                                {member.profile?.name ??
                                  member.profile?.username}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm">
                        {feedbackData.assignedProfile?.name ??
                          feedbackData.assignedProfile?.username ??
                          "Unassigned"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-muted-foreground">
                      Author
                    </span>
                    <ProfileLinkOrUnknown
                      profile={feedbackData.author}
                      display="name"
                    />
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-muted-foreground">
                      Watchers
                    </span>
                    <div className="flex items-center -space-x-1.5">
                      <div className="size-5 rounded-full border-2 border-background bg-emerald-500" />
                      <div className="size-5 rounded-full border-2 border-background bg-blue-500" />
                      <div className="size-5 rounded-full border-2 border-background bg-purple-500" />
                      <span className="ml-2 text-xs text-muted-foreground">
                        +12
                      </span>
                    </div>
                  </div>
                </div>
              </SidebarSection>

              <SidebarSection
                icon={<Tag className="size-3.5" />}
                onOpenChange={(open) => setSidebarSection("labels", open)}
                open={sidebarState.labels}
                title="Labels"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className="gap-1 font-normal" variant="secondary">
                    <span className="size-1.5 rounded-full bg-blue-500" />
                    feature-request
                  </Badge>
                  <Badge className="gap-1 font-normal" variant="secondary">
                    <span className="size-1.5 rounded-full bg-purple-500" />
                    ux
                  </Badge>
                  <Badge className="gap-1 font-normal" variant="secondary">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    enhancement
                  </Badge>
                  <Button
                    className="h-6 gap-1 px-2 text-xs text-muted-foreground"
                    size="sm"
                    variant="ghost"
                  >
                    <Plus className="size-3" />
                    Add
                  </Button>
                </div>
              </SidebarSection>

              <SidebarSection
                icon={<LinkIcon className="size-3.5" />}
                onOpenChange={(open) => setSidebarSection("related", open)}
                open={sidebarState.related}
                title="Related"
              >
                <div className="flex flex-col">
                  <div className="flex cursor-pointer items-center gap-2.5 rounded-md py-2 transition-colors hover:bg-muted/50">
                    <StatusIcon colored size="14" status="completed" />
                    <span className="flex-1 truncate text-sm">
                      Add dark mode support
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex cursor-pointer items-center gap-2.5 rounded-md py-2 transition-colors hover:bg-muted/50">
                    <StatusIcon colored size="14" status="in-progress" />
                    <span className="flex-1 truncate text-sm">
                      Improve mobile responsiveness
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                  <Link
                    className={cn(
                      buttonVariants({ size: "sm", variant: "ghost" }),
                      "mt-1 h-8 w-full justify-start gap-1.5 px-0 text-xs text-muted-foreground"
                    )}
                    params={{ org: params.org, project: params.project }}
                    to="/@{$org}/$project/feedback"
                  >
                    <Plus className="size-3" />
                    Link related feedback
                  </Link>
                </div>
              </SidebarSection>
            </div>
          </div>

          <div className="flex flex-col gap-4 py-8 md:col-span-8">
            <div className="flex w-full items-center border-b pb-2">
              <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <MessageSquare className="size-3.5" />
                Discussion
              </h2>
            </div>
            <CommentEditorProvider>
              {firstComment || timelineItems.length > 0 ? (
                <ul
                  className={cn(
                    "relative flex flex-col gap-6",
                    timelineItems.length > 0 &&
                      "before:absolute before:top-0 before:bottom-0 before:left-[33px] before:z-0 before:border-r before:border-border"
                  )}
                >
                  {firstComment ? (
                    <CommentCard
                      badges={
                        <>
                          <CommentBadge kind="author" label="Author" />
                          {firstCommentWithEmotes?.isTeamMember ? (
                            <CommentBadge kind="team" label="Team" />
                          ) : null}
                        </>
                      }
                      comment={
                        {
                          ...firstComment,
                          author: feedbackData.author,
                          canDelete: firstCommentWithEmotes?.canDelete,
                          canEdit: firstCommentWithEmotes?.canEdit,
                          emoteCounts: firstCommentWithEmotes?.emoteCounts,
                        } as ThreadComment
                      }
                      currentProfileId={currentProfile?.id}
                      isDeleting={commentDeleteMutation.isPending}
                      isUpdating={commentUpdateMutation.isPending}
                      onDelete={(commentId) =>
                        commentDeleteMutation.mutate({ _id: commentId })
                      }
                      onToggleEmote={(commentId, content) =>
                        commentEmoteMutation.mutate({
                          content,
                          feedbackCommentId: commentId,
                          feedbackId: feedback.id,
                        })
                      }
                      onUpdate={(commentId, content) =>
                        commentUpdateMutation.mutate({
                          _id: commentId,
                          content,
                        })
                      }
                      verb="opened this feedback"
                    />
                  ) : null}
                  {timelineItems.map((item) =>
                    item.type === "comment" ? (
                      <CommentCard
                        badges={
                          <>
                            {item.data.author?.id ===
                            feedback.authorProfileId ? (
                              <CommentBadge kind="author" label="Author" />
                            ) : null}
                            {item.data.isTeamMember ? (
                              <CommentBadge kind="team" label="Team" />
                            ) : null}
                            {feedback.answerCommentId === item.data.id ? (
                              <CommentBadge kind="answer" label="Answer" />
                            ) : null}
                          </>
                        }
                        className={
                          feedback.answerCommentId === item.data.id
                            ? "border-green-500 dark:border-green-600"
                            : undefined
                        }
                        comment={item.data as ThreadComment}
                        currentProfileId={currentProfile?.id}
                        dropdownItems={
                          canMarkAnswer ? (
                            <DropdownMenuItem
                              onClick={() =>
                                answerMutation.mutate({
                                  commentId:
                                    feedback.answerCommentId === item.data.id
                                      ? null
                                      : item.data.id,
                                  feedbackId: feedback.id,
                                })
                              }
                            >
                              <Check size={14} />
                              {feedback.answerCommentId === item.data.id
                                ? "Unmark as answer"
                                : "Mark as answer"}
                            </DropdownMenuItem>
                          ) : null
                        }
                        isDeleting={commentDeleteMutation.isPending}
                        isUpdating={commentUpdateMutation.isPending}
                        key={item.data.id}
                        onDelete={(commentId) =>
                          commentDeleteMutation.mutate({ _id: commentId })
                        }
                        onToggleEmote={(commentId, content) =>
                          commentEmoteMutation.mutate({
                            content,
                            feedbackCommentId: commentId,
                            feedbackId: feedback.id,
                          })
                        }
                        onUpdate={(commentId, content) =>
                          commentUpdateMutation.mutate({
                            _id: commentId,
                            content,
                          })
                        }
                        railClassName={
                          feedback.answerCommentId === item.data.id
                            ? "border-r-green-700 bg-linear-to-b from-green-400/20 via-green-400/10 to-transparent"
                            : undefined
                        }
                      />
                    ) : (
                      <FeedbackEventItem event={item.data} key={item.data.id} />
                    )
                  )}
                </ul>
              ) : null}

              <CommentForm
                isAuthenticated={isAuthenticated}
                isSubmitting={commentCreateMutation.isPending}
                onSubmit={async (content) => {
                  await commentCreateMutation.mutateAsync({
                    content,
                    feedbackId: feedback.id,
                  })
                }}
                placeholder="Leave a comment..."
                redirectTo={`/@${params.org}/${params.project}/feedback/${params.slug}`}
                signedOut="rich"
                submitLabel="Comment"
              />
            </CommentEditorProvider>
          </div>
        </div>
      </div>
    </div>
  )
}

function CommentBadge({
  kind,
  label,
}: {
  kind: "answer" | "author" | "team"
  label: string
}) {
  const Icon = kind === "team" ? Users : Check
  const className =
    kind === "answer"
      ? "inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400"
      : kind === "team"
        ? "inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
        : "inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"

  return (
    <span className={className}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

function FeedbackEventItem({ event }: { event: FeedbackEventData }) {
  const Icon = getEventIcon(event.eventType)
  const createdAt = getTimestamp(event.createdAt)

  return (
    <li className="relative z-10 flex items-start gap-3 py-2 pl-4">
      <div className="ml-0.5 flex h-6 w-8 shrink-0 items-center justify-center">
        <div className="flex h-6 w-6 items-center justify-center rounded-full border bg-muted">
          <Icon className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
        {event.actor ? (
          <Link
            className="font-medium text-foreground hocus:underline"
            params={{ username: event.actor.username }}
            to="/u/$username"
          >
            @{event.actor.username}
          </Link>
        ) : (
          <span className="font-medium text-foreground">Someone</span>
        )}{" "}
        {getEventDescription(event)}{" "}
        <Tooltip>
          <TooltipTrigger asChild delay={100}>
            <span
              className="cursor-pointer border-b border-dotted border-foreground/30 text-foreground/50"
              suppressHydrationWarning
            >
              {formatRelativeDay(createdAt)}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <span suppressHydrationWarning>{formatFullDate(createdAt)}</span>
          </TooltipContent>
        </Tooltip>
      </div>
    </li>
  )
}

function getEventIcon(eventType: FeedbackEventData["eventType"]) {
  switch (eventType) {
    case "status_changed":
      return ArrowRightLeft
    case "board_changed":
      return FolderInput
    case "assigned":
      return UserPlus
    case "unassigned":
      return UserMinus
    case "answer_marked":
      return CheckCircle2
    case "answer_unmarked":
      return CircleX
    default:
      return Check
  }
}

function getEventDescription(event: FeedbackEventData) {
  const { eventType, metadata, targetProfile } = event

  switch (eventType) {
    case "status_changed":
      return (
        <span className="inline-flex flex-wrap items-center gap-1">
          changed status from <StatusPill status={metadata?.oldValue} /> to{" "}
          <StatusPill status={metadata?.newValue} />
        </span>
      )
    case "board_changed":
      return (
        <span>
          moved to board{" "}
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
            {metadata?.newValue ?? "Unknown"}
          </span>
        </span>
      )
    case "assigned":
      return (
        <span>
          assigned{" "}
          {targetProfile ? (
            <Link
              className="font-medium hocus:underline"
              params={{ username: targetProfile.username }}
              to="/u/$username"
            >
              @{targetProfile.username}
            </Link>
          ) : (
            <span className="text-muted-foreground">unknown user</span>
          )}
        </span>
      )
    case "unassigned":
      return (
        <span>
          unassigned{" "}
          {targetProfile ? (
            <Link
              className="font-medium hocus:underline"
              params={{ username: targetProfile.username }}
              to="/u/$username"
            >
              @{targetProfile.username}
            </Link>
          ) : (
            <span className="text-muted-foreground">unknown user</span>
          )}
        </span>
      )
    case "answer_marked":
      return <span>marked a comment as the answer</span>
    case "answer_unmarked":
      return <span>unmarked the answer</span>
    default:
      return <span>made a change</span>
  }
}

function StatusPill({ status }: { status?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5">
      {status ? (
        <StatusIcon colored size="12" status={status as never} />
      ) : null}
      <span className="text-xs font-medium">{status ?? "none"}</span>
    </span>
  )
}

function getTimestamp(value: number | string | Date) {
  if (value instanceof Date) return value.getTime()
  if (typeof value === "string") return new Date(value).getTime()
  return value
}
