import { DataModel, Id } from '@convex/_generated/dataModel';
import { ProjectMember } from '@convex/schema/projectMember.schema';
import { GenericQueryCtx } from 'convex/server';

import { GetProjectArgs } from './getProject';

type GetProjectMemberArgs = {
	project: GetProjectArgs;
	profile: {
		id: Id<'profile'>;
	};
};

export const getProjectMember = async (
	ctx: GenericQueryCtx<DataModel>,
	{ project, profile }: GetProjectMemberArgs
) => {
	let projectMember: ProjectMember | null = null;

	if (project.id) {
		projectMember = await ctx.db
			.query('projectMember')
			.withIndex('by_profileId_projectId', (q) =>
				q.eq('profileId', profile.id).eq('projectId', project.id as Id<'project'>)
			)
			.unique();
	} else if (project.slug) {
		projectMember = await ctx.db
			.query('projectMember')
			.withIndex('by_profileId_projectSlug', (q) =>
				q.eq('profileId', profile.id).eq('projectSlug', project.slug as string)
			)
			.unique();
	}

	if (!projectMember) return null;

	return projectMember;
};
