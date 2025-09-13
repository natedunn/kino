import { GenericQueryCtx } from 'convex/server';

import { DataModel, Id } from '@/convex/_generated/dataModel';
import { SelectProjectSchema, selectProjectSchema } from '@/convex/schema/project.schema';

import { getOrgUserData } from './getOrgUserData';

type UserIsProjectAdmin =
	| {
			projectId: Id<'project'>;
			projectSlug?: never;
	  }
	| {
			projectId?: never;
			projectSlug: string;
	  };

export const getProjectUserData = async (
	ctx: GenericQueryCtx<DataModel>,
	args: UserIsProjectAdmin
): Promise<{
	permissions: {
		isAdmin: boolean;
		canEdit: boolean;
		canView: boolean;
		canDelete: boolean;
	};
	project: SelectProjectSchema | null;
	orgUser: Awaited<ReturnType<typeof getOrgUserData>> | null;
}> => {
	//
	// Get project data
	let projectData;
	if (args?.projectId) {
		projectData = await ctx.db.get(args.projectId);
	} else if (args?.projectSlug) {
		projectData = await ctx.db
			.query('project')
			.withIndex('by_slug', (q) => q.eq('slug', args.projectSlug))
			.unique();
	}

	const project = selectProjectSchema.parse(projectData);

	if (!project) {
		return {
			permissions: {
				isAdmin: false,
				canEdit: false,
				canView: false,
				canDelete: false,
			},
			project,
			orgUser: null,
		};
	}

	//
	// Get user's org data
	const orgUserData = await getOrgUserData(ctx, {
		orgSlug: project.orgSlug,
	});

	const userId = orgUserData.userId;

	if (!userId) {
		return {
			permissions: {
				isAdmin: false,
				canEdit: false,
				canView: project.visibility === 'public',
				canDelete: false,
			},
			project,
			orgUser: orgUserData,
		};
	}

	if (userId && !orgUserData.permissions.isAdmin) {
		//
		// If the user is not a admin or owner of the org, we will check for project permissions
		const projectUser = await ctx.db
			.query('projectUser')
			.withIndex('by_userId_projectId', (q) => q.eq('userId', userId).eq('projectId', project._id))
			.unique();

		if (!projectUser) {
			return {
				permissions: {
					isAdmin: false,
					canEdit: false,
					canView: false,
					canDelete: false,
				},
				project,
				orgUser: orgUserData,
			};
		}

		return {
			permissions: {
				isAdmin: projectUser.role === 'admin',
				canEdit: projectUser.role === 'admin',
				canView: project.visibility === 'public' || projectUser.role === 'admin',
				canDelete: false,
			},
			project,
			orgUser: orgUserData,
		};
	}

	//
	// Org admin or owner — can do anything
	return {
		permissions: {
			isAdmin: true,
			canEdit: true,
			canView: true,
			canDelete: orgUserData.member?.role === 'owner',
		},
		project,
		orgUser: orgUserData,
	};
};
