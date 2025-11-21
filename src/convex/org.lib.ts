import { GenericMutationCtx, GenericQueryCtx } from 'convex/server';
import { ConvexError } from 'convex/values';

import { components } from './_generated/api';
import { DataModel } from './_generated/dataModel';
import { findOrgMember } from './orgMember.lib';
import { findMyProfile } from './profile.lib';
import { OrgSchema, selectOrgSchema } from './schema/org.schema';
import { OrgMember } from './schema/orgMember.schema';
import { SelectProfileSchema } from './schema/profile.schema';

export type OrgIdentifiers = {
	id?: string;
	slug?: string;
};

const _findOrg = async (ctx: GenericQueryCtx<DataModel>, { id, slug }: OrgIdentifiers) => {
	const orgData = await ctx.runQuery(components.betterAuth.org.findByIdOrSlug, {
		id,
		slug,
	});

	if (!orgData) return null;

	return selectOrgSchema.parse(orgData);
};

export const findOrg = async (ctx: GenericQueryCtx<DataModel>, args: OrgIdentifiers) =>
	await _findOrg(ctx, args);

export const getOrg = async (ctx: GenericQueryCtx<DataModel>, args: OrgIdentifiers) => {
	const org = await _findOrg(ctx, args);
	if (!org) {
		throw new ConvexError({
			message: 'Organization not found',
			code: '404',
		});
	}

	return org;
};

type VerifyOrgAccessReturn = {
	org: OrgSchema | null;
	profile: SelectProfileSchema | null;
	permissions: {
		canEdit: boolean;
		canView: boolean;
		canDelete: boolean;
		canCreate: boolean; // Creating an new sub resources, including projects
	};
};

type VerifyOrgAccessOpts = {
	id?: string;
	slug?: string;
};

export const verifyOrgAccess = async (
	ctx: GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>,
	{ id, slug }: VerifyOrgAccessOpts
): Promise<VerifyOrgAccessReturn> => {
	if (!id && !slug) {
		throw new ConvexError({
			message: 'No identifiers were passed. Provide an `id` or a `slug`',
			code: '400',
		});
	}
	const org = await getOrg(ctx, { id, slug });
	const profile = await findMyProfile(ctx);

	let orgMember: OrgMember | null = null;

	if (profile) {
		orgMember = await findOrgMember(ctx, {
			org: {
				id,
				slug,
			},
			profile: {
				id: profile._id,
			},
		});
	}

	const { visibility } = org;
	const role = orgMember?.role ?? '_none';

	if (profile && profile.role === 'system:admin') {
		return {
			org,
			profile,
			permissions: {
				canEdit: true,
				canView: true,
				canDelete: true,
				canCreate: false,
			},
		};
	}

	if (profile && profile.role === 'system:editor') {
		return {
			org,
			profile,
			permissions: {
				canEdit: true,
				canView: true,
				canDelete: false,
				canCreate: false,
			},
		};
	}

	if (!profile || role === '_none') {
		return {
			org: visibility === 'public' ? org : null,
			profile,
			permissions: {
				canEdit: false,
				canView: visibility === 'public',
				canDelete: false,
				canCreate: false,
			},
		};
	}

	if (visibility === 'public') {
		return {
			org,
			profile,
			permissions: {
				canEdit: ['admin', 'editor'].includes(role),
				canView: true,
				canDelete: role === 'admin',
				canCreate: role === 'admin',
			},
		};
	}

	if (visibility === 'private') {
		const viewable = ['admin', 'editor'].includes(role);
		return {
			org: viewable ? org : null,
			profile,
			permissions: {
				canEdit: viewable,
				canView: viewable,
				canDelete: role === 'admin',
				canCreate: role === 'admin',
			},
		};
	}

	return {
		org: null,
		profile: null,
		permissions: {
			canCreate: false,
			canDelete: false,
			canEdit: false,
			canView: false,
		},
	};
};
