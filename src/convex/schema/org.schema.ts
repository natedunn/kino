import { tables } from '@convex/betterAuth/generatedSchema';
import { convexToZod } from 'convex-helpers/server/zod4';
import * as z from 'zod';

const betterAuthOrgSchema = convexToZod(tables.organization.validator);

export const orgSchema = betterAuthOrgSchema.extend(
	z.object({
		_id: z.string(),
		_creationTime: z.number(),
		logo: z.string().optional(),
		slug: z
			.string()
			.regex(/^[a-z0-9_]+(?:-[a-z0-9_]+)*$/, {
				message:
					'Invalid slug format. Slugs can only contain lowercase letters, numbers, underscores, and hyphens. They cannot start or end with a hyphen, or have consecutive hyphens.',
			})
			.min(1, 'Slug cannot be empty.')
			.max(100, 'Slug cannot be longer than 100 characters.'),
		visibility: z.enum(['public', 'private']),
		metadata: z.object().optional(),
	}).shape
);

export type OrgSchema = z.infer<typeof orgSchema>;

export const selectOrgSchema = orgSchema;
export const createOrgSchema = orgSchema.omit({
	_id: true,
	_creationTime: true,
	createdAt: true,
});

export const updateOrgSchema = createOrgSchema
	.pick({
		name: true,
		logo: true,
	})
	.partial()
	.extend(
		z.object({
			currentSlug: orgSchema.shape.slug,
			updatedSlug: orgSchema.shape.slug.optional(),
		}).shape
	);
