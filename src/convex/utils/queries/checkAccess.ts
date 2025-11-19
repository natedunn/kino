import { DataModel } from '@convex/_generated/dataModel';
import { SelectProfileSchema } from '@convex/schema/profile.schema';
import { ProjectSchema } from '@convex/schema/project.schema';
import { GenericMutationCtx, GenericQueryCtx } from 'convex/server';
import { ConvexError } from 'convex/values';

import { getCurrentProfile } from './getCurrentProfile';
import { getProject, GetProjectArgs } from './getProject';
import { getProjectMember } from './getProjectMember';

type CheckProjectAccessReturn = {
	project: ProjectSchema | null;
	profile: SelectProfileSchema | null;
	permissions: {
		canEdit: boolean;
		canView: boolean;
		canDelete: boolean;
	};
};

export const checkProjectAccess = async (
	ctx: GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>,
	{ id, slug }: GetProjectArgs
): Promise<CheckProjectAccessReturn> => {
	const project = await getProject(ctx, { id, slug });

	if (!project) {
		throw new ConvexError({
			message: 'Project not found',
			code: '404',
		});
	}

	const profile = await getCurrentProfile(ctx);

	if (project.visibility === 'public') {
		return {
			project,
			profile,
			permissions: {
				canEdit: false,
				canView: true,
				canDelete: false,
			},
		};
	} else if (['private', 'archived', 'isolated', 'gated'].includes(project.visibility)) {
		if (!profile) {
			return {
				project: null,
				profile: null,
				permissions: {
					canEdit: false,
					canView: false,
					canDelete: false,
				},
			};
		}

		const projectMember = await getProjectMember(ctx, {
			project: {
				id,
				slug,
			},
			profile: {
				id: profile._id,
			},
		});

		if (!projectMember) {
			return {
				project: null,
				profile: null,
				permissions: {
					canEdit: false,
					canView: false,
					canDelete: false,
				},
			};
		}

		const { visibility } = project;
		const { role } = projectMember;

		if (role === 'system:admin') {
			return {
				project,
				profile,
				permissions: {
					canEdit: true,
					canView: true,
					canDelete: true,
				},
			};
		}

		if (role === 'system:editor') {
			return {
				project,
				profile,
				permissions: {
					canEdit: true,
					canView: true,
					canDelete: false,
				},
			};
		}

		if (visibility === 'private' && ['admin', 'member', 'org:admin', 'org:editor'].includes(role)) {
			return {
				project,
				profile,
				permissions: {
					canEdit: ['admin', 'org:admin', 'org:editor'].includes(role),
					canView: true,
					canDelete: role === 'org:admin',
				},
			};
		}

		if (visibility === 'gated' && ['admin', 'member', 'org:admin', 'org:editor'].includes(role)) {
			return {
				project,
				profile,
				permissions: {
					canEdit: ['admin', 'org:admin', 'org:editor'].includes(role),
					canView: true,
					canDelete: role === 'org:admin',
				},
			};
		}

		if (
			visibility === 'isolated' &&
			['admin', 'member', 'org:admin', 'org:editor'].includes(role)
		) {
			return {
				project,
				profile,
				permissions: {
					canEdit: ['admin', 'org:admin', 'org:editor'].includes(role),
					canView: true,
					canDelete: role === 'org:admin',
				},
			};
		}

		if (
			visibility === 'archived' &&
			['admin', 'member', 'org:admin', 'org:editor'].includes(role)
		) {
			return {
				project,
				profile,
				permissions: {
					canEdit: ['admin', 'org:admin', 'org:editor'].includes(role),
					canView: true,
					canDelete: role === 'org:admin',
				},
			};
		}
	}
	return {
		project: null,
		profile: null,
		permissions: {
			canEdit: false,
			canView: false,
			canDelete: false,
		},
	};
};
