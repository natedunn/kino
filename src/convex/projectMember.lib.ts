import { DataModel, Id } from '@convex/_generated/dataModel';
import { ProjectMember } from '@convex/schema/projectMember.schema';
import { GenericQueryCtx } from 'convex/server';
import { ConvexError } from 'convex/values';

import { ProjectIdentifiers } from '@/convex/project.lib';

type GetProjectMemberArgs = {
	project: ProjectIdentifiers;
	profile: {
		id: Id<'profile'>;
	};
};

const _findProjectMember = async (
	ctx: GenericQueryCtx<DataModel>,
	{ project, profile }: GetProjectMemberArgs
) => {
	if (!project.id && !project.slug) {
		throw new ConvexError({
			message: 'No identifiers were passed. Provide an `id` or a `slug`',
			code: '400',
		});
	}

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

export const findProjectMember = async (
	ctx: GenericQueryCtx<DataModel>,
	args: GetProjectMemberArgs
) => await _findProjectMember(ctx, args);

export const getProjectMember = async (
	ctx: GenericQueryCtx<DataModel>,
	args: GetProjectMemberArgs
) => {
	const projectMember = await _findProjectMember(ctx, args);

	if (!projectMember) {
		throw new ConvexError({
			message: 'Project member not found',
			code: '404',
		});
	}

	return projectMember;
};
