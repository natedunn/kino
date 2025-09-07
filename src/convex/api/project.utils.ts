import { projectSchema } from '@/convex/schema/project.schema';

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
