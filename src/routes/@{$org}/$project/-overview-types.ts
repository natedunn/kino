import type { Icon as IconType } from "@/icons/types"

// Types for the static Project Overview draft. These describe the *mock* shapes
// rendered on the overview dashboard. The project header binds to real data
// (see index.tsx); everything below is placeholder until wired to the backend.

export type UpdateCategory = "changelog" | "article" | "announcement"

export type ActivityKind =
  | "feedback_created"
  | "feedback_status_changed"
  | "update_published"
  | "member_joined"
  | "github_linked"

export interface StatCard {
  key: string
  label: string
  value: number
  /** Small delta hint, e.g. "+12 this week". Optional. */
  hint?: string
  Icon: IconType
}

export interface UpdatePreview {
  id: string
  title: string
  category: UpdateCategory
  author: string
  /** Human date label, e.g. "Jun 24". */
  date: string
  commentCount: number
}

export interface Member {
  id: string
  name: string
  role: "Owner" | "Admin" | "Editor" | "Member"
  imageUrl?: string
}

export interface ActivityEvent {
  id: string
  kind: ActivityKind
  actor: string
  /** Pre-composed summary text for the feed row. */
  summary: string
  when: string
}
