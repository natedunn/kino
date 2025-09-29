import { z } from 'zod';

import { SHARED_SCHEMA } from './_shared';

export const projectSchema = z.object({
	...SHARED_SCHEMA('project'),
	orgSlug: z.string(),
	name: z.string().min(1).max(100),
	description: z.string().max(280).optional(),
	urls: z.object({ url: z.string().url(), text: z.string() }).array().optional(),
	visibility: z.enum(['private', 'public', 'archived']),
	logoUrl: z.string().url().optional(),
	slug: z
		.string()
		.regex(/^[a-z0-9_]+(?:-[a-z0-9_]+)*$/, {
			message:
				'Invalid slug format. Slugs can only contain lowercase letters, numbers, underscores, and hyphens. They cannot start or end with a hyphen, or have consecutive hyphens.',
		})
		.min(1, 'Slug cannot be empty.')
		.max(100, 'Slug cannot be longer than 100 characters.'),
});

export const createProjectSchema = projectSchema.pick({
	name: true,
	description: true,
	urls: true,
	slug: true,
	orgSlug: true,
	visibility: true,
});

export const updateProjectSchema = createProjectSchema.merge(
	projectSchema.pick({
		_id: true,
	})
);

export const selectProjectSchema = projectSchema.pick({
	_id: true,
	name: true,
	description: true,
	urls: true,
	slug: true,
	orgSlug: true,
	visibility: true,
});

export type ProjectSchema = z.infer<typeof projectSchema>;
export type SelectProjectSchema = z.infer<typeof selectProjectSchema>;
export type CreateProjectSchema = z.infer<typeof createProjectSchema>;
export type UpdateProjectSchema = z.infer<typeof updateProjectSchema>;
