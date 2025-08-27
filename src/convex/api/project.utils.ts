import { projectSchema } from '../schema';

export const createProjectSchema = projectSchema.pick({
	name: true,
	description: true,
	urls: true,
	private: true,
	slug: true,
	orgId: true,
});
