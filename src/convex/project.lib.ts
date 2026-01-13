import { DataModel, Id } from '@convex/_generated/dataModel';
import { ProjectSchema } from '@convex/schema/project.schema';
import { GenericMutationCtx, GenericQueryCtx } from 'convex/server';
import { ConvexError } from 'convex/values';

import { findMyProfile } from './profile.lib';
import { findProjectMember } from './projectMember.lib';
import { SelectProfileSchema } from './schema/profile.schema';
import { ProjectMember } from './schema/projectMember.schema';

/**
 * Get and find project utils
 */

export type ProjectIdentifiers = {
	id?: Id<'project'>;
	slug?: string;
};

const _findOrg = async (ctx: GenericQueryCtx<DataModel>, { id, slug }: ProjectIdentifiers) => {
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

export const findProject = async (ctx: GenericQueryCtx<DataModel>, args: ProjectIdentifiers) =>
	await _findOrg(ctx, args);

export const getProject = async (ctx: GenericQueryCtx<DataModel>, args: ProjectIdentifiers) => {
	const org = await _findOrg(ctx, args);

	if (!org) {
		throw new ConvexError({
			message: 'Project not found',
			code: '404',
		});
	}

	return org;
};

type VerifyProjectAccessReturn = {
	project: ProjectSchema | null;
	profile: SelectProfileSchema | null;
	permissions: {
		canEdit: boolean;
		canView: boolean;
		canDelete: boolean;
	};
};

/**
 * Verify Project Access
 *
 * @argument ctx - Query or Mutation context
 * @argument identifiers - `id` or `slug` to check against the correct project
 */
export const verifyProjectAccess = async (
	ctx: GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>,
	{ id, slug }: ProjectIdentifiers
): Promise<VerifyProjectAccessReturn> => {
	if (!id && !slug) {
		throw new ConvexError({
			message: 'No identifiers were passed. Provide an `id` or a `slug`',
			code: '400',
		});
	}

	const project = await getProject(ctx, { id, slug });
	const profile = await findMyProfile(ctx);

	// console.log('profile >>>', profile);

	let projectMember: ProjectMember | null = null;

	if (profile) {
		projectMember = await findProjectMember(ctx, {
			project: {
				id,
				slug,
			},
			profile: {
				id: profile._id,
			},
		});
	}

	const { visibility } = project;
	const role = projectMember?.role ?? '_none';

	if (profile && profile.role === 'system:admin') {
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

	if (profile && profile.role === 'system:editor') {
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

	if (!profile && role === '_none') {
		return {
			project: visibility === 'public' ? project : null,
			profile,
			permissions: {
				canEdit: false,
				canView: visibility === 'public',
				canDelete: false,
			},
		};
	}

	if (visibility === 'public') {
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

	if (visibility === 'private') {
		const viewable = ['admin', 'member', 'org:admin', 'org:editor'].includes(role);
		return {
			project: viewable ? project : null,
			profile,
			permissions: {
				canEdit: ['admin', 'org:admin', 'org:editor'].includes(role),
				canView: viewable,
				canDelete: role === 'org:admin',
			},
		};
	}

	if (visibility === 'archived') {
		const viewable = ['admin', 'org:admin', 'org:editor'].includes(role);
		return {
			project: viewable ? project : null,
			profile,
			permissions: {
				canEdit: false,
				canView: viewable,
				canDelete: role === 'org:admin',
			},
		};
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
