import { GenericQueryCtx } from 'convex/server';
import z from 'zod';

import { DataModel, Id } from '@/convex/_generated/dataModel';

import { components } from '../../_generated/api';
import { authComponent } from '../../auth';
import { getInternalUserId } from './getInternalUserId';
import { getOrgBySlug } from './getOrgBySlug';

const memberSchema = z.object({
	_id: z.string(),
	userId: z.string(),
	organizationId: z.string(),
	role: z.string(),
});

type Member = z.infer<typeof memberSchema>;

export const getOrgUserData = async (
	ctx: GenericQueryCtx<DataModel>,
	{
		orgSlug,
	}: {
		orgSlug: string;
	}
): Promise<{
	permissions: {
		isAdmin: boolean;
		isOwner: boolean;
		canEdit: boolean;
		canView: boolean;
		canDelete: boolean;
	};
	org: Awaited<ReturnType<typeof getOrgBySlug>>;
	member: Member | null;
	userId: Id<'user'> | null;
}> => {
	const userId = (await authComponent.getAuthUser(ctx))?.userId;

	const internalUserId = await getInternalUserId(ctx, userId as Id<'user'>);

	const org = await getOrgBySlug(ctx, orgSlug);
	if (!org) {
		return {
			permissions: {
				isAdmin: false,
				isOwner: false,
				canEdit: false,
				canView: false,
				canDelete: false,
			},
			org: null,
			member: null,
			userId: userId as Id<'user'> | null,
		};
	}

	if (!internalUserId) {
		return {
			permissions: {
				isAdmin: false,
				isOwner: false,
				canView: true,
				canEdit: false,
				canDelete: false,
			},
			org,
			member: null,
			userId: null,
		};
	}

	// Check if user admin or owner
	const memberData = await ctx.runQuery(components.betterAuth.adapter.findOne, {
		model: 'member',
		where: [
			{ field: 'userId', operator: 'eq', value: internalUserId },
			{
				field: 'organizationId',
				operator: 'eq',
				value: org._id,
			},
		],
	});

	const member = memberSchema.parse(memberData);

	const isAdmin = member?.role === 'admin' || member?.role === 'owner';
	const isOwner = member?.role === 'owner';

	return {
		permissions: {
			isAdmin,
			isOwner,
			canEdit: isAdmin,
			canView: true,
			canDelete: isOwner,
		},
		org,
		member,
		userId: userId as Id<'user'> | null,
	};
};
