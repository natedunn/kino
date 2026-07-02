import { z } from "zod"

export const FORM_LIMITS = {
  boardDescription: 250,
  boardName: 50,
  comment: 1200,
  feedbackTitle: 100,
  githubBody: 6000,
  githubTitle: 256,
  feedbackSearch: 120,
  email: 254,
  orgName: 100,
  orgSlug: 39,
  projectDescription: 250,
  projectName: 30,
  projectSlug: 30,
  tag: 40,
  updateContent: 50000,
  updateTitle: 200,
  url: 2048,
  urlLabel: 100,
  username: 39,
} as const

export const MAX_PROJECT_URLS = 10

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const SLUG_INPUT_PATTERN = "[a-z0-9]+(-[a-z0-9]+)*"

export const USERNAME_MIN_LENGTH = 3

export const RESERVED_HANDLES = [
  "about",
  "account",
  "accounts",
  "acme",
  "activity",
  "admin",
  "administrator",
  "admins",
  "amazon",
  "api",
  "app",
  "apple",
  "apps",
  "archive",
  "archived",
  "ass",
  "asset",
  "assets",
  "auth",
  "bastard",
  "billing",
  "bitch",
  "board",
  "boards",
  "bot",
  "bullshit",
  "callback",
  "changelog",
  "chat",
  "cock",
  "crap",
  "create",
  "create-project",
  "cunt",
  "damn",
  "dashboard",
  "delete",
  "deleted",
  "deleted-feedback",
  "dick",
  "discussion",
  "discussions",
  "doc",
  "docs",
  "douche",
  "edit",
  "email",
  "error",
  "facebook",
  "feedback",
  "file",
  "files",
  "fuck",
  "github",
  "google",
  "help",
  "home",
  "image",
  "images",
  "instagram",
  "integration",
  "integrations",
  "invite",
  "invites",
  "join",
  "kino",
  "legal",
  "linkedin",
  "login",
  "logout",
  "member",
  "members",
  "meta",
  "microsoft",
  "netflix",
  "new",
  "nigger",
  "notification",
  "notifications",
  "null",
  "nvidia",
  "oauth",
  "openai",
  "option",
  "options",
  "oracle",
  "org",
  "organization",
  "organizations",
  "orgs",
  "piss",
  "pricing",
  "prick",
  "privacy",
  "private",
  "profile",
  "profiles",
  "project",
  "projects",
  "public",
  "pussy",
  "roadmap",
  "root",
  "samsung",
  "security",
  "setting",
  "settings",
  "shit",
  "signin",
  "signout",
  "signup",
  "slut",
  "status",
  "support",
  "system",
  "team",
  "teams",
  "terms",
  "tesla",
  "tiktok",
  "twat",
  "twitter",
  "undefined",
  "update",
  "updates",
  "u",
  "ui",
  "user",
  "users",
  "wank",
  "webhook",
  "webhooks",
  "whatsapp",
  "whore",
  "x",
  "youtube",
] as const

const reservedHandleSet = new Set<string>(RESERVED_HANDLES)

function normalizeReservedHandle(value: string) {
  return value.trim().toLowerCase().replaceAll("_", "-")
}

export function isReservedHandle(value: string) {
  return reservedHandleSet.has(normalizeReservedHandle(value))
}

export function normalizeSlugInput(value: string, max: number) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "")
}

/**
 * Live filter for a manual slug <input>'s onChange. Lowercases, turns
 * whitespace runs into a hyphen, and strips characters that can never appear in
 * a slug — but, unlike `normalizeSlugInput`, does NOT trim trailing hyphens or
 * collapse repeats, so the user can still type "my-org" one key at a time. The
 * final shape (no leading/trailing/double hyphen) is enforced by the schema on
 * submit.
 */
export function filterSlugInput(value: string, max: number) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .slice(0, max)
}

/**
 * Live filter for a username <input>'s onChange. Usernames allow underscores
 * (unlike slugs). Lowercases and drops disallowed characters so mobile users
 * can't type values the schema will later reject.
 */
export function filterUsernameInput(value: string, max: number) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, max)
}

const slug = (max: number) =>
  z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Slug is required")
    .max(max, `Slug must be ${max} characters or fewer`)
    .regex(SLUG_PATTERN, {
      message: "Use lowercase letters, numbers, and single hyphens",
    })
    .refine((value) => !isReservedHandle(value), {
      message: "This slug is reserved",
    })

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(FORM_LIMITS.email)
  .email()

export const orgFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(FORM_LIMITS.orgName),
  slug: slug(FORM_LIMITS.orgSlug).optional().or(z.literal("")),
  visibility: z.enum(["public", "private"]).default("public"),
})

export const httpUrlSchema = z
  .string()
  .trim()
  .url("Enter a valid URL")
  .max(FORM_LIMITS.url)
  .refine(
    (value) => {
      try {
        const protocol = new URL(value).protocol
        return protocol === "http:" || protocol === "https:"
      } catch {
        return false
      }
    },
    { message: "URL must start with http:// or https://" }
  )

export const projectUrlSchema = z.object({
  // Client hint; the server re-verifies "github" links before trusting them.
  source: z.enum(["manual", "github"]).optional(),
  text: z
    .string()
    .trim()
    .min(1, "Link label is required")
    .max(FORM_LIMITS.urlLabel),
  url: httpUrlSchema,
})

export const projectUrlListSchema = z.array(projectUrlSchema).max(MAX_PROJECT_URLS)

export const projectFormSchema = z.object({
  description: z
    .string()
    .trim()
    .max(FORM_LIMITS.projectDescription)
    .optional(),
  name: z
    .string()
    .trim()
    .min(1, "Project name is required")
    .max(FORM_LIMITS.projectName),
  slug: slug(FORM_LIMITS.projectSlug),
  urls: projectUrlListSchema.optional(),
  visibility: z.enum(["public", "private", "archived"]).default("public"),
})

export const profileFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(FORM_LIMITS.orgName),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(
      USERNAME_MIN_LENGTH,
      `Username must be at least ${USERNAME_MIN_LENGTH} characters`
    )
    .max(FORM_LIMITS.username)
    .regex(/^[a-z0-9_]+$/, {
      message: "Use lowercase letters, numbers, and underscores",
    })
    .refine((value) => !isReservedHandle(value), {
      message: "This username is reserved",
    }),
})

export const feedbackFormSchema = z.object({
  firstComment: z
    .string()
    .trim()
    .min(1, "Comment is required")
    .max(FORM_LIMITS.comment),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(FORM_LIMITS.feedbackTitle),
})

export const boardFormSchema = z.object({
  description: z.string().trim().max(FORM_LIMITS.boardDescription).optional(),
  name: z
    .string()
    .trim()
    .min(1, "Board name is required")
    .max(FORM_LIMITS.boardName),
  slug: slug(FORM_LIMITS.projectSlug),
})

export const updateFormSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Content is required")
    .max(FORM_LIMITS.updateContent),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(FORM_LIMITS.tag)
        .regex(/^[^\s,][^,]*[^\s,]$|^[^\s,]$/)
    )
    .max(20),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(FORM_LIMITS.updateTitle),
})

export function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Please check the highlighted fields"
}
