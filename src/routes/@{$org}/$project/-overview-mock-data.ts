import type {
  ActivityEvent,
  Member,
  StatCard,
  UpdatePreview,
} from "./-overview-types"
import ArchivePencil from "@/icons/archive-pencil"
import CalendarDays from "@/icons/calendar-days"
import ChartUp from "@/icons/chart-up"
import Interview from "@/icons/interview"
import Roadmap from "@/icons/roadmap"

// TODO: replace with real data once wired to the backend. These are placeholder
// values for the static Project Overview draft.

export const MOCK_STATS: Array<StatCard> = [
  {
    key: "open-feedback",
    label: "Open feedback",
    value: 128,
    hint: "+14 this week",
    Icon: ArchivePencil,
  },
  {
    key: "upvotes",
    label: "Total upvotes",
    value: 3412,
    hint: "+207 this week",
    Icon: ChartUp,
  },
  {
    key: "roadmap-active",
    label: "In progress",
    value: 6,
    hint: "on the roadmap",
    Icon: Roadmap,
  },
  {
    key: "updates",
    label: "Published updates",
    value: 34,
    hint: "+2 this month",
    Icon: CalendarDays,
  },
  {
    key: "members",
    label: "Members",
    value: 9,
    hint: "3 admins",
    Icon: Interview,
  },
]

export const MOCK_RECENT_UPDATES: Array<UpdatePreview> = [
  {
    id: "u1",
    title: "Roadmap timeline view is now live",
    category: "changelog",
    author: "Nate Dunn",
    date: "Jun 24",
    commentCount: 8,
  },
  {
    id: "u2",
    title: "Introducing GitHub issue sync",
    category: "announcement",
    author: "Nate Dunn",
    date: "Jun 12",
    commentCount: 21,
  },
  {
    id: "u3",
    title: "How we think about public roadmaps",
    category: "article",
    author: "Priya Shah",
    date: "May 30",
    commentCount: 4,
  },
]

export const MOCK_MEMBERS: Array<Member> = [
  { id: "m1", name: "Nate Dunn", role: "Owner" },
  { id: "m2", name: "Priya Shah", role: "Admin" },
  { id: "m3", name: "Marcus Lee", role: "Admin" },
  { id: "m4", name: "Jordan Kim", role: "Editor" },
  { id: "m5", name: "Sam Rivera", role: "Editor" },
  { id: "m6", name: "Alex Chen", role: "Member" },
  { id: "m7", name: "Robin Patel", role: "Member" },
  { id: "m8", name: "Dana Woods", role: "Member" },
  { id: "m9", name: "Chris Vaughn", role: "Member" },
]

export const MOCK_ACTIVITY: Array<ActivityEvent> = [
  {
    id: "a1",
    kind: "update_published",
    actor: "Nate Dunn",
    summary: "published “Roadmap timeline view is now live”",
    when: "2h ago",
  },
  {
    id: "a2",
    kind: "feedback_status_changed",
    actor: "Priya Shah",
    summary: "moved “Bulk-edit statuses” to In Progress",
    when: "3h ago",
  },
  {
    id: "a3",
    kind: "feedback_created",
    actor: "Alex Chen",
    summary: "opened “Dark mode flashes white on initial load”",
    when: "5h ago",
  },
  {
    id: "a4",
    kind: "github_linked",
    actor: "Marcus Lee",
    summary: "linked GitHub issue #482 to a feedback item",
    when: "Yesterday",
  },
  {
    id: "a5",
    kind: "member_joined",
    actor: "Chris Vaughn",
    summary: "joined the project as Member",
    when: "2d ago",
  },
]
