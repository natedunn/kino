import { z } from "zod"

export const VALIDATION_LIMITS = {
  boardDescription: 250,
  boardIcon: 50,
  boardName: 50,
  comment: 1200,
  cursor: 8192,
  feedbackSearch: 120,
  feedbackTitle: 100,
  githubBody: 6000,
  githubNodeId: 128,
  githubState: 4096,
  githubTitle: 256,
  id: 256,
  email: 254,
  orgName: 100,
  orgSlug: 39,
  projectDescription: 250,
  projectName: 30,
  projectSlug: 30,
  generatedSlug: 64,
  storageKey: 512,
  tag: 40,
  updateContent: 50000,
  updateTitle: 200,
  urlLabel: 100,
  username: 39,
  webhookAction: 80,
  webhookDeliveryId: 120,
  webhookEvent: 80,
  webhookPayloadString: 512,
} as const

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const RESERVED_HANDLES = [
  "about",
  "account",
  "accounts",
  "activity",
  "admin",
  "administrator",
  "admins",
  "api",
  "app",
  "apps",
  "archive",
  "archived",
  "asset",
  "assets",
  "auth",
  "billing",
  "board",
  "boards",
  "bot",
  "callback",
  "changelog",
  "chat",
  "create",
  "create-project",
  "dashboard",
  "delete",
  "deleted",
  "deleted-feedback",
  "discussion",
  "discussions",
  "doc",
  "docs",
  "edit",
  "email",
  "error",
  "feedback",
  "file",
  "files",
  "github",
  "help",
  "home",
  "image",
  "images",
  "integration",
  "integrations",
  "invite",
  "invites",
  "join",
  "kino",
  "legal",
  "login",
  "logout",
  "member",
  "members",
  "new",
  "notification",
  "notifications",
  "null",
  "oauth",
  "option",
  "options",
  "org",
  "organization",
  "organizations",
  "orgs",
  "pricing",
  "privacy",
  "private",
  "profile",
  "profiles",
  "project",
  "projects",
  "public",
  "roadmap",
  "root",
  "security",
  "setting",
  "settings",
  "signin",
  "signout",
  "signup",
  "status",
  "support",
  "system",
  "team",
  "teams",
  "terms",
  "undefined",
  "update",
  "updates",
  "u",
  "ui",
  "user",
  "users",
  "webhook",
  "webhooks",
] as const

const reservedHandleSet = new Set<string>(RESERVED_HANDLES)

function normalizeReservedHandle(value: string) {
  return value.trim().toLowerCase().replaceAll("_", "-")
}

export function isReservedHandle(value: string) {
  return reservedHandleSet.has(normalizeReservedHandle(value))
}

export function normalizeSlug(
  value: string,
  max: number = VALIDATION_LIMITS.generatedSlug
) {
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

export const idSchema = z.string().trim().min(1).max(VALIDATION_LIMITS.id)
export const idArraySchema = z.array(idSchema).max(100)
export const idListSchema = idArraySchema.min(1)
export const optionalIdSchema = idSchema.optional()
export const nullableIdSchema = idSchema.nullable()
export const cursorSchema = z.string().max(VALIDATION_LIMITS.cursor).optional()

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(VALIDATION_LIMITS.orgSlug)
  .regex(SLUG_PATTERN, {
    message: "Use lowercase letters, numbers, and single hyphens",
  })

export const reservedSlugSchema = slugSchema.refine(
  (value) => !isReservedHandle(value),
  {
    message: "This slug is reserved",
  }
)

export const orgSlugSchema = slugSchema.max(VALIDATION_LIMITS.orgSlug)
export const projectSlugSchema = slugSchema.max(VALIDATION_LIMITS.projectSlug)
export const orgSlugWriteSchema = reservedSlugSchema.max(
  VALIDATION_LIMITS.orgSlug
)
export const projectSlugWriteSchema = reservedSlugSchema.max(
  VALIDATION_LIMITS.projectSlug
)
export const generatedSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(VALIDATION_LIMITS.generatedSlug)
  .regex(SLUG_PATTERN)

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(VALIDATION_LIMITS.username)
  .regex(/^[a-z0-9_]+$/, {
    message: "Use lowercase letters, numbers, and underscores",
  })
  .refine((value) => !isReservedHandle(value), {
    message: "This username is reserved",
  })

export const orgNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(VALIDATION_LIMITS.orgName)
export const projectNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(VALIDATION_LIMITS.projectName)
export const projectDescriptionSchema = z
  .string()
  .trim()
  .max(VALIDATION_LIMITS.projectDescription)
export const boardNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(VALIDATION_LIMITS.boardName)
export const boardDescriptionSchema = z
  .string()
  .trim()
  .max(VALIDATION_LIMITS.boardDescription)
export const boardIconSchema = z
  .string()
  .trim()
  .max(VALIDATION_LIMITS.boardIcon)
export const feedbackTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(VALIDATION_LIMITS.feedbackTitle)
export const commentContentSchema = z
  .string()
  .trim()
  .min(1)
  .max(VALIDATION_LIMITS.comment)
export const updateTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(VALIDATION_LIMITS.updateTitle)
export const updateContentSchema = z
  .string()
  .trim()
  .min(1)
  .max(VALIDATION_LIMITS.updateContent)
export const feedbackSearchSchema = z
  .string()
  .trim()
  .max(VALIDATION_LIMITS.feedbackSearch)
export const tagSchema = z
  .string()
  .trim()
  .min(1)
  .max(VALIDATION_LIMITS.tag)
  .regex(/^[^\s,][^,]*[^\s,]$|^[^\s,]$/, {
    message: "Tags cannot start or end with spaces or include commas",
  })
export const tagListSchema = z.array(tagSchema).max(20)

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(VALIDATION_LIMITS.email)
  .email()

export const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
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

export const urlSchema = z.object({
  text: z.string().trim().min(1).max(VALIDATION_LIMITS.urlLabel),
  url: httpUrlSchema,
})
export const urlListSchema = z.array(urlSchema).max(10)

export const storageKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(VALIDATION_LIMITS.storageKey)

export const callbackTargetUrlSchema = httpUrlSchema
export const githubStateSchema = z
  .string()
  .trim()
  .min(1)
  .max(VALIDATION_LIMITS.githubState)
export const githubCodeSchema = z.string().trim().min(1).max(512)
export const githubNodeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(VALIDATION_LIMITS.githubNodeId)
export const githubTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(VALIDATION_LIMITS.githubTitle)
export const githubBodySchema = z
  .string()
  .trim()
  .max(VALIDATION_LIMITS.githubBody)
export const githubUrlSchema = httpUrlSchema
export const githubLoginSchema = z.string().trim().min(1).max(100)
export const githubRepoNameSchema = z.string().trim().min(1).max(100)
export const githubRepoFullNameSchema = z.string().trim().min(1).max(220)
export const githubStateValueSchema = z.string().trim().min(1).max(40)
export const webhookActionSchema = z
  .string()
  .trim()
  .max(VALIDATION_LIMITS.webhookAction)
  .optional()
export const webhookDeliveryIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(VALIDATION_LIMITS.webhookDeliveryId)
export const webhookEventSchema = z
  .string()
  .trim()
  .min(1)
  .max(VALIDATION_LIMITS.webhookEvent)
export const webhookPayloadStringSchema = z
  .string()
  .trim()
  .min(1)
  .max(VALIDATION_LIMITS.webhookPayloadString)
