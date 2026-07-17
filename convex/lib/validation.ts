import { z } from 'zod';

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
	target: 16,
	updateContent: 50000,
	updateTitle: 200,
	url: 2048,
	urlLabel: 100,
	username: 39,
	webhookAction: 80,
	webhookDeliveryId: 120,
	webhookEvent: 80,
	webhookPayloadString: 512,
} as const;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const RESERVED_HANDLES = [
	'about',
	'account',
	'accounts',
	'acme',
	'activity',
	'admin',
	'administrator',
	'admins',
	'amazon',
	'api',
	'app',
	'apple',
	'apps',
	'archive',
	'archived',
	'ass',
	'asset',
	'assets',
	'auth',
	'bastard',
	'billing',
	'bitch',
	'board',
	'boards',
	'bot',
	'bullshit',
	'callback',
	'changelog',
	'chat',
	'cock',
	'crap',
	'create',
	'create-project',
	'cunt',
	'damn',
	'dashboard',
	'delete',
	'deleted',
	'deleted-feedback',
	'dick',
	'discussion',
	'discussions',
	'doc',
	'docs',
	'douche',
	'edit',
	'email',
	'error',
	'facebook',
	'feedback',
	'file',
	'files',
	'fuck',
	'github',
	'google',
	'help',
	'home',
	'image',
	'images',
	'instagram',
	'integration',
	'integrations',
	'invite',
	'invites',
	'join',
	'kino',
	'legal',
	'linkedin',
	'login',
	'logout',
	'member',
	'members',
	'meta',
	'microsoft',
	'netflix',
	'new',
	'nigger',
	'notification',
	'notifications',
	'null',
	'nvidia',
	'oauth',
	'openai',
	'option',
	'options',
	'oracle',
	'org',
	'organization',
	'organizations',
	'orgs',
	'piss',
	'pricing',
	'prick',
	'privacy',
	'private',
	'profile',
	'profiles',
	'project',
	'projects',
	'public',
	'pussy',
	'roadmap',
	'root',
	'samsung',
	'security',
	'setting',
	'settings',
	'shit',
	'signin',
	'signout',
	'signup',
	'slut',
	'status',
	'support',
	'system',
	'team',
	'teams',
	'terms',
	'tesla',
	'tiktok',
	'twat',
	'twitter',
	'undefined',
	'update',
	'updates',
	'u',
	'ui',
	'user',
	'users',
	'wank',
	'webhook',
	'webhooks',
	'whatsapp',
	'whore',
	'x',
	'youtube',
] as const;

const reservedHandleSet = new Set<string>(RESERVED_HANDLES);

function normalizeReservedHandle(value: string) {
	return value.trim().toLowerCase().replaceAll('_', '-');
}

export function isReservedHandle(value: string) {
	return reservedHandleSet.has(normalizeReservedHandle(value));
}

export function normalizeSlug(value: string, max: number = VALIDATION_LIMITS.generatedSlug) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9 -]+/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, max)
		.replace(/-+$/g, '');
}

export const idSchema = z.string().trim().min(1).max(VALIDATION_LIMITS.id);
export const idArraySchema = z.array(idSchema).max(100);
export const idListSchema = idArraySchema.min(1);
export const optionalIdSchema = idSchema.optional();
export const nullableIdSchema = idSchema.nullable();
export const cursorSchema = z.string().max(VALIDATION_LIMITS.cursor).optional();

const SLUG_MESSAGE = 'Use lowercase letters, numbers, and single hyphens';

// Strict slug used on WRITE paths: enforces the canonical slug format so we
// never persist a malformed slug.
//
// Build each slug schema from its own cap so that the entity's limit is the
// single source of truth. Previously a base schema baked in `orgSlug` (39) and
// the project variant chained a second `.max(projectSlug)` (30); zod applied
// both and the stricter silently won — which would break the moment a project
// cap was ever raised above the org cap. Per-entity construction avoids that.
function makeSlugSchema(max: number) {
	return z
		.string()
		.trim()
		.toLowerCase()
		.min(1)
		.max(max)
		.regex(SLUG_PATTERN, { message: SLUG_MESSAGE });
}

function makeReservedSlugSchema(max: number) {
	return makeSlugSchema(max).refine((value) => !isReservedHandle(value), {
		message: 'This slug is reserved',
	});
}

// Lenient slug used on READ/lookup paths: validates size only, never format. A
// lookup must not start throwing just because a stored slug predates a later
// rule change — a value that doesn't match simply won't be found. Trim/lowercase
// keep the lookup key normalized.
function makeReadSlugSchema(max: number) {
	return z.string().trim().toLowerCase().max(max);
}

export const orgSlugSchema = makeReadSlugSchema(VALIDATION_LIMITS.orgSlug);
export const projectSlugSchema = makeReadSlugSchema(VALIDATION_LIMITS.projectSlug);
export const orgSlugWriteSchema = makeReservedSlugSchema(VALIDATION_LIMITS.orgSlug);
export const projectSlugWriteSchema = makeReservedSlugSchema(VALIDATION_LIMITS.projectSlug);
// Read/lookup schema for system-generated slugs (feedback/update permalinks).
// Lenient (size-only) for the same reason as the other read slug schemas.
export const generatedSlugSchema = makeReadSlugSchema(VALIDATION_LIMITS.generatedSlug);

export const usernameSchema = z
	.string()
	.trim()
	.toLowerCase()
	.min(3)
	.max(VALIDATION_LIMITS.username)
	.regex(/^[a-z0-9_]+$/, {
		message: 'Use lowercase letters, numbers, and underscores',
	})
	.refine((value) => !isReservedHandle(value), {
		message: 'This username is reserved',
	});

export const orgNameSchema = z.string().trim().min(1).max(VALIDATION_LIMITS.orgName);
export const projectNameSchema = z.string().trim().min(1).max(VALIDATION_LIMITS.projectName);
export const projectDescriptionSchema = z.string().trim().max(VALIDATION_LIMITS.projectDescription);
export const boardNameSchema = z.string().trim().min(1).max(VALIDATION_LIMITS.boardName);
export const boardDescriptionSchema = z.string().trim().max(VALIDATION_LIMITS.boardDescription);
export const boardIconSchema = z.string().trim().max(VALIDATION_LIMITS.boardIcon);
export const feedbackTitleSchema = z.string().trim().min(1).max(VALIDATION_LIMITS.feedbackTitle);
export const commentContentSchema = z.string().trim().min(1).max(VALIDATION_LIMITS.comment);
export const updateTitleSchema = z.string().trim().min(1).max(VALIDATION_LIMITS.updateTitle);
export const updateContentSchema = z.string().trim().min(1).max(VALIDATION_LIMITS.updateContent);
export const feedbackSearchSchema = z.string().trim().max(VALIDATION_LIMITS.feedbackSearch);
export const targetSchema = z.string().trim().max(VALIDATION_LIMITS.target);
export const tagSchema = z
	.string()
	.trim()
	.min(1)
	.max(VALIDATION_LIMITS.tag)
	.regex(/^[^\s,][^,]*[^\s,]$|^[^\s,]$/, {
		message: 'Tags cannot start or end with spaces or include commas',
	});
export const tagListSchema = z.array(tagSchema).max(20);

export const emailSchema = z.string().trim().toLowerCase().max(VALIDATION_LIMITS.email).email();

export const httpUrlSchema = z
	.string()
	.trim()
	.url()
	.max(VALIDATION_LIMITS.url)
	.refine(
		(value) => {
			try {
				const protocol = new URL(value).protocol;
				return protocol === 'http:' || protocol === 'https:';
			} catch {
				return false;
			}
		},
		{ message: 'URL must start with http:// or https://' }
	);

export const urlSchema = z.object({
	// `source` is a client hint only. "github" links are re-verified server-side
	// against the connected repo before `verifiedAt` is trusted (see project.update).
	source: z.enum(['manual', 'github']).optional(),
	text: z.string().trim().min(1).max(VALIDATION_LIMITS.urlLabel),
	url: httpUrlSchema,
});
export const urlListSchema = z.array(urlSchema).max(10);

export const storageKeySchema = z.string().trim().min(1).max(VALIDATION_LIMITS.storageKey);

export const callbackTargetUrlSchema = httpUrlSchema;
export const githubStateSchema = z.string().trim().min(1).max(VALIDATION_LIMITS.githubState);
export const githubCodeSchema = z.string().trim().min(1).max(512);
export const githubNodeIdSchema = z.string().trim().min(1).max(VALIDATION_LIMITS.githubNodeId);
export const githubTitleSchema = z.string().trim().min(1).max(VALIDATION_LIMITS.githubTitle);
export const githubBodySchema = z.string().trim().max(VALIDATION_LIMITS.githubBody);
export const githubUrlSchema = httpUrlSchema;
export const githubLoginSchema = z.string().trim().min(1).max(100);
export const githubRepoNameSchema = z.string().trim().min(1).max(100);
export const githubRepoFullNameSchema = z.string().trim().min(1).max(220);
export const githubStateValueSchema = z.string().trim().min(1).max(40);
export const webhookActionSchema = z
	.string()
	.trim()
	.max(VALIDATION_LIMITS.webhookAction)
	.optional();
export const webhookDeliveryIdSchema = z
	.string()
	.trim()
	.min(1)
	.max(VALIDATION_LIMITS.webhookDeliveryId);
export const webhookEventSchema = z.string().trim().min(1).max(VALIDATION_LIMITS.webhookEvent);
export const webhookPayloadStringSchema = z
	.string()
	.trim()
	.min(1)
	.max(VALIDATION_LIMITS.webhookPayloadString);
