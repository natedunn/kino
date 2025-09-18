import { GenericQueryCtx } from 'convex/server';

import { DataModel, Id } from '@/convex/_generated/dataModel';
import { SelectProjectSchema, selectProjectSchema } from '@/convex/schema/project.schema';

import { getOrgDetails } from './getOrgDetails';

type GetProjectUserDetailsArgs =
	| {
			projectId: Id<'project'>;
			projectSlug?: never;
	  }
	| {
			projectId?: never;
			projectSlug: string;
	  };
type GetProjectUserDetailsReturn = Promise<{
	permissions: {
		isAdmin: boolean;
		canEdit: boolean;
		canView: boolean;
		canDelete: boolean;
	};
	project: SelectProjectSchema | null;
	orgUser: Awaited<ReturnType<typeof getOrgDetails>> | null;
}>;

export const getProjectUserDetails = async (
	ctx: GenericQueryCtx<DataModel>,
	args: GetProjectUserDetailsArgs
): GetProjectUserDetailsReturn => {
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
	const orgDetails = await getOrgDetails(ctx, {
		slug: project.orgSlug,
	});

	const userId = orgDetails?.userId;

	if (!userId) {
		return {
			permissions: {
				isAdmin: false,
				canEdit: false,
				canView: project.visibility === 'public',
				canDelete: false,
			},
			project,
			orgUser: orgDetails,
		};
	}

	if (userId && !orgDetails.permissions.isAdmin) {
		//
		// If the user is not a admin or owner of the org, we will check for project permissions
		const projectUser = await ctx.db
			.query('projectUser')
			.withIndex('by_userId_projectId', (q) =>
				q.eq('userId', userId as Id<'user'>).eq('projectId', project._id)
			)
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
				orgUser: orgDetails,
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
			orgUser: orgDetails,
		};
	}

	//
	// Org admin or owner — can do anything
	return {
		permissions: {
			isAdmin: true,
			canEdit: true,
			canView: true,
			canDelete: orgDetails.member?.role === 'owner',
		},
		project,
		orgUser: orgDetails,
	};
};
