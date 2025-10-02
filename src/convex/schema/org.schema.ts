import z from 'zod';

// const betterAuthOrgSchema = convexToZod(
// 	v.object({
// 		name: v.string(),
// 		slug: v.optional(v.union(v.null(), v.string())),
// 		logo: v.optional(v.union(v.null(), v.string())),
// 		createdAt: v.number(),
// 		metadata: v.optional(v.union(v.null(), v.string())),
// 	})
// );

export const orgSchema = z.object({
	_id: z.string(),
	_creationTime: z.number(),
	name: z.string(),
	slug: z
		.string()
		.regex(/^[a-z0-9_]+(?:-[a-z0-9_]+)*$/, {
			message:
				'Invalid slug format. Slugs can only contain lowercase letters, numbers, underscores, and hyphens. They cannot start or end with a hyphen, or have consecutive hyphens.',
		})
		.min(1, 'Slug cannot be empty.')
		.max(100, 'Slug cannot be longer than 100 characters.'),
	logo: z.string().optional(),
	metaData: z.string().optional().nullable(),
});

export const selectOrgSchema = orgSchema;
export const createOrgSchema = orgSchema;

export const updateOrgSchema = createOrgSchema
	.pick({
		name: true,
		logo: true,
	})
	.partial()
	.merge(
		createOrgSchema.pick({
			slug: true,
		})
	);
