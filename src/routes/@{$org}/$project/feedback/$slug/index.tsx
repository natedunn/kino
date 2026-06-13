import {
  ArrowRightLeft,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleX,
  ExternalLink,
  FolderInput,
  GitBranch,
  Info,
  Link as LinkIcon,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Tag,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import {
  Link,
  createFileRoute,
  notFound,
  useNavigate,
} from "@tanstack/react-router"

import { ProfileLinkOrUnknown } from "@/components/profile-link"
import { RoutePending } from "@/components/route-pending"
import { SidebarSection } from "@/components/sidebar-section"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input-shadcn"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { GithubIcon, StatusIcon } from "@/icons"
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
  connections: true,
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

type GitHubConnectionData = {
  githubNumber: number
  id: string
  kind: "issue"
  state: string
  title: string
  url: string
}

type GitHubTargetData = {
  databaseId?: number
  kind: "issue"
  nodeId: string
  number: number
  state: string
  title: string
  url: string
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
        crpcServer.feedbackGithub.listByFeedback.queryOptions({
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
  const navigate = useNavigate()
  const crpc = useCRPC()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [deleteError, setDeleteError] = useState("")
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false)
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
  const githubConnectionsQuery = useQuery(
    crpc.feedbackGithub.listByFeedback.queryOptions({
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
  const refreshGithubConnectionsMutation = useMutation(
    crpc.feedbackGithub.refreshCounts.mutationOptions()
  )
  const markForDeletionMutation = useMutation(
    crpc.feedback.markForDeletion.mutationOptions({
      onError: (error) => setDeleteError(error.message),
      onSuccess: () => {
        setDeleteDialogOpen(false)
        navigate({
          params: { org: params.org, project: params.project },
          to: "/@{$org}/$project/feedback",
        })
      },
    })
  )

  const canSubmitDelete =
    deleteAcknowledged &&
    deleteConfirmText === "DELETE" &&
    !markForDeletionMutation.isPending
  const visibleGithubConnections = githubConnectionsQuery.data ?? []
  const showGithubConnectionsSection =
    projectData.permissions.canEdit || visibleGithubConnections.length > 0

  useEffect(() => {
    if (!projectData.permissions.canEdit) return
    if (visibleGithubConnections.length === 0) return
    if (refreshGithubConnectionsMutation.isPending) return

    refreshGithubConnectionsMutation.mutate(
      { feedbackId: feedback.id },
      {
        onSuccess: () => {
          void githubConnectionsQuery.refetch()
        },
      }
    )
  }, [
    feedback.id,
    visibleGithubConnections.length,
    projectData.permissions.canEdit,
  ])

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
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) {
            setDeleteAcknowledged(false)
            setDeleteConfirmText("")
            setDeleteError("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete feedback</DialogTitle>
            <DialogDescription>
              This marks the Feedback for complete database deletion in 48
              hours. It will immediately disappear from normal views, feeds,
              search, and admin/editor lists. After permanent deletion there is
              no recovery.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
              <input
                checked={deleteAcknowledged}
                className="mt-0.5"
                onChange={(event) =>
                  setDeleteAcknowledged(event.target.checked)
                }
                type="checkbox"
              />
              <span>
                I understand this Feedback will be permanently deleted after the
                48-hour recovery window.
              </span>
            </label>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="delete-feedback">
                Type DELETE to confirm
              </label>
              <Input
                id="delete-feedback"
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                value={deleteConfirmText}
              />
            </div>
            {deleteError ? (
              <p className="text-sm text-destructive">{deleteError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setDeleteDialogOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={!canSubmitDelete}
              onClick={() => {
                setDeleteError("")
                markForDeletionMutation.mutate({ id: feedback.id })
              }}
              type="button"
              variant="destructive"
            >
              <Trash2 className="size-4" />
              Mark for deletion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <GitHubConnectionDialog
        connectionsQuery={githubConnectionsQuery}
        feedbackId={feedback.id}
        feedbackTitle={feedback.title}
        open={connectionDialogOpen}
        onOpenChange={setConnectionDialogOpen}
        orgSlug={params.org}
        projectSlug={params.project}
      />
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
            {projectData.permissions.canEdit ? (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button className="size-8" size="icon" variant="ghost">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Admin actions</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setDeleteDialogOpen(true)}
                    variant="destructive"
                  >
                    <Trash2 className="size-4" />
                    Delete feedback
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
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

              {showGithubConnectionsSection ? (
                <SidebarSection
                  icon={<GitBranch className="size-3.5" />}
                  onOpenChange={(open) =>
                    setSidebarSection("connections", open)
                  }
                  open={sidebarState.connections}
                  title="Connections"
                >
                  <div className="flex flex-col">
                    {visibleGithubConnections.length > 0 ? (
                      visibleGithubConnections.map(
                        (connection: GitHubConnectionData) => (
                          <a
                            className="group flex min-w-0 items-center gap-2.5 rounded-md py-2 transition-colors hover:bg-muted/50"
                            href={connection.url}
                            key={connection.id}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <GithubConnectionIcon />
                            <span className="min-w-0 flex-1 overflow-hidden text-sm whitespace-nowrap [-webkit-mask-image:linear-gradient(to_right,black_calc(100%_-_1.5rem),transparent)] [mask-image:linear-gradient(to_right,black_calc(100%_-_1.5rem),transparent)]">
                              #{connection.githubNumber} {connection.title}
                            </span>
                            <GithubIssueStateBadge state={connection.state} />
                            <ExternalLink className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                          </a>
                        )
                      )
                    ) : (
                      <p className="py-2 text-sm text-muted-foreground">
                        No GitHub items connected.
                      </p>
                    )}
                    {projectData.permissions.canEdit ? (
                      <Button
                        className="mt-1 h-8 w-full justify-start gap-1.5 px-0 text-xs text-muted-foreground"
                        onClick={() => setConnectionDialogOpen(true)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Plus className="size-3" />
                        Add connection
                      </Button>
                    ) : null}
                  </div>
                </SidebarSection>
              ) : null}

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

function GithubConnectionIcon() {
  return <GithubIcon className="size-3.5 shrink-0 text-muted-foreground" />
}

function GithubIssueStateBadge({ state }: { state: string }) {
  const normalizedState = state.trim().toLowerCase()
  const isOpen = normalizedState === "open"

  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium whitespace-nowrap capitalize",
        isOpen
          ? "bg-green-500/10 text-green-600 dark:text-green-400"
          : "bg-muted text-muted-foreground"
      )}
    >
      {normalizedState || "unknown"}
    </span>
  )
}

function GitHubConnectionDialog({
  connectionsQuery,
  feedbackId,
  feedbackTitle,
  onOpenChange,
  open,
  orgSlug,
  projectSlug,
}: {
  connectionsQuery: { refetch: () => Promise<unknown> }
  feedbackId: string
  feedbackTitle: string
  onOpenChange: (open: boolean) => void
  open: boolean
  orgSlug: string
  projectSlug: string
}) {
  const crpc = useCRPC()
  const [mode, setMode] = useState<"existing" | "create">("existing")
  const [query, setQuery] = useState("")
  const [selectedTarget, setSelectedTarget] = useState<GitHubTargetData | null>(
    null
  )
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")

  const searchMutation = useMutation(
    crpc.feedbackGithub.searchTargets.mutationOptions()
  )
  const availabilityQuery = useQuery(
    crpc.feedbackGithub.getAvailability.queryOptions(
      { feedbackId },
      { enabled: open, skipUnauth: true }
    )
  )
  const connectExistingMutation = useMutation(
    crpc.feedbackGithub.connectExisting.mutationOptions({
      onSuccess: async () => {
        await connectionsQuery.refetch()
        onOpenChange(false)
      },
    })
  )
  const createMutation = useMutation(
    crpc.feedbackGithub.createAndConnect.mutationOptions({
      onSuccess: async () => {
        await connectionsQuery.refetch()
        onOpenChange(false)
      },
    })
  )

  useEffect(() => {
    if (!open) {
      setMode("existing")
      setQuery("")
      setSelectedTarget(null)
      setTitle("")
      setBody("")
      searchMutation.reset()
      connectExistingMutation.reset()
      createMutation.reset()
    }
  }, [open])

  useEffect(() => {
    if (!open || mode !== "existing") return
    if (availabilityQuery.data && !availabilityQuery.data.issuesEnabled) return

    const timeout = window.setTimeout(() => {
      searchMutation.mutate({ feedbackId, kind: "issue", query })
      setSelectedTarget(null)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [availabilityQuery.data?.issuesEnabled, feedbackId, mode, open, query])

  const searchResults = (searchMutation.data ?? []) as GitHubTargetData[]
  const availability = availabilityQuery.data
  const sourceDisabled = !!availability && !availability.issuesEnabled
  const writeDisabled =
    !!availability && availability.connected && !availability.writable
  const repoMissing = !!availability && !availability.connected
  const error =
    availabilityQuery.error?.message ??
    connectExistingMutation.error?.message ??
    createMutation.error?.message ??
    searchMutation.error?.message
  const feedbackUrl =
    typeof window === "undefined" ? "" : window.location.href.split("#")[0]
  const canCreate =
    title.trim().length > 0 &&
    !createMutation.isPending &&
    !sourceDisabled &&
    !writeDisabled &&
    !repoMissing
  const canConnect =
    !!selectedTarget &&
    !sourceDisabled &&
    !writeDisabled &&
    !repoMissing &&
    !connectExistingMutation.isPending &&
    !searchMutation.isPending

  function handleConnectExisting() {
    if (!selectedTarget || !feedbackUrl) return

    connectExistingMutation.mutate({
      feedbackId,
      feedbackUrl,
      githubNumber: selectedTarget.number,
      kind: "issue",
    })
  }

  function handleCreate() {
    if (!feedbackUrl) return

    createMutation.mutate({
      body,
      feedbackId,
      feedbackUrl,
      kind: "issue",
      title: title.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
              <GithubIcon className="size-4 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-sm leading-tight font-semibold">
                Connect GitHub
              </h2>
              <p className="mt-0.5 line-clamp-1 max-w-xs text-xs text-muted-foreground">
                {feedbackTitle}
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 border-y bg-muted/30 px-5 py-2">
          {/* Mode segmented control */}
          <div className="flex items-center rounded-md bg-background p-0.5 shadow-sm ring-1 ring-border/60">
            <button
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-all",
                mode === "existing"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMode("existing")}
              type="button"
            >
              Link existing
            </button>
            <button
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-all",
                mode === "create"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMode("create")}
              type="button"
            >
              Create new
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {availabilityQuery.isLoading ? (
            <div className="space-y-2">
              <div className="h-9 animate-pulse rounded-lg bg-muted/50" />
              <div className="h-14 animate-pulse rounded-lg bg-muted/50" />
              <div className="h-14 animate-pulse rounded-lg bg-muted/50" />
            </div>
          ) : sourceDisabled ? (
            <GitHubConnectionNotice
              description="Issues are not enabled for this project's connected GitHub repository."
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              title="Enable GitHub Issues"
            />
          ) : repoMissing ? (
            <GitHubConnectionNotice
              description="Connect a GitHub repository before linking feedback to issues."
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              title="Connect a GitHub repository"
            />
          ) : writeDisabled ? (
            <GitHubConnectionNotice
              description="This GitHub repository is connected read-only. Reconnect it with read/write access before linking feedback."
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              title="Reconnect with write access"
            />
          ) : mode === "existing" ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-9 text-sm"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search issues..."
                  value={query}
                />
              </div>
              <div className="space-y-1">
                {searchMutation.isPending ? (
                  <div className="space-y-1.5">
                    <div className="h-14 animate-pulse rounded-lg bg-muted/50" />
                    <div className="h-14 animate-pulse rounded-lg bg-muted/50" />
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((target) => (
                    <button
                      className={cn(
                        "flex w-full min-w-0 items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-all hover:bg-muted/50",
                        selectedTarget?.nodeId === target.nodeId
                          ? "border-primary/25 bg-primary/5 ring-1 ring-primary/20"
                          : "hover:border-border/60"
                      )}
                      key={target.nodeId}
                      onClick={() => setSelectedTarget(target)}
                      type="button"
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                        <GithubConnectionIcon />
                      </div>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm leading-tight font-medium">
                          #{target.number} {target.title}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              target.state === "open"
                                ? "bg-green-500"
                                : "bg-muted-foreground/50"
                            )}
                          />
                          {target.state}
                        </span>
                      </span>
                      {selectedTarget?.nodeId === target.nodeId ? (
                        <Check className="size-3.5 shrink-0 text-primary" />
                      ) : null}
                    </button>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                    {searchMutation.data
                      ? "No issues found."
                      : "Loading issues..."}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Title
                </label>
                <Input
                  className="h-9 text-sm"
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Issue title"
                  value={title}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Body{" "}
                  <span className="font-normal text-muted-foreground/60">
                    (optional)
                  </span>
                </label>
                <Textarea
                  className="min-h-28 resize-none text-sm"
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Add a description…"
                  value={body}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t bg-muted/20 px-5 py-3">
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => onOpenChange(false)}
              size="sm"
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            {mode === "existing" ? (
              <Button
                disabled={!canConnect}
                onClick={handleConnectExisting}
                size="sm"
                type="button"
              >
                <LinkIcon className="size-3.5" />
                Connect
              </Button>
            ) : (
              <Button
                disabled={!canCreate}
                onClick={handleCreate}
                size="sm"
                type="button"
              >
                <Plus className="size-3.5" />
                Create & connect
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function GitHubConnectionNotice({
  description,
  orgSlug,
  projectSlug,
  title,
}: {
  description: string
  orgSlug: string
  projectSlug: string
  title: string
}) {
  return (
    <div className="rounded-lg border border-dashed p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <GithubIcon className="size-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-sm leading-tight font-medium">{title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <Button asChild size="sm" type="button" variant="outline">
            <Link
              params={{ org: orgSlug, project: projectSlug }}
              to="/@{$org}/$project/settings/integrations"
            >
              <GithubIcon className="size-3.5" />
              Open GitHub settings
            </Link>
          </Button>
        </div>
      </div>
    </div>
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
