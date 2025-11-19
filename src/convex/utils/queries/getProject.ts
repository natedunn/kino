import { DataModel, Id } from '@convex/_generated/dataModel';
import { ProjectSchema } from '@convex/schema/project.schema';
import { GenericQueryCtx } from 'convex/server';

export type GetProjectArgs = {
	id?: Id<'project'>;
	slug?: string;
};

export const getProject = async (ctx: GenericQueryCtx<DataModel>, { id, slug }: GetProjectArgs) => {
	let project: ProjectSchema | null = null;

	if (id) {
		project = await ctx.db.get(id);
	} else if (slug) {
		project = await ctx.db
			.query('project')
			.withIndex('by_slug', (q) => q.eq('slug', slug))
			.unique();
	}

	if (!project) return null;

	return project;
};
