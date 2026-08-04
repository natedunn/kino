import { CRPCError } from 'kitcn/server';
import { z } from 'zod';

import { verifyOrgAccess } from '../lib/kino';

// Moderators are organization identities with explicit project assignments;
// the Better Auth role itself grants no organization-management permissions.
// `owner` is deliberately absent: it can never be granted or revoked through
// role management, only through a future ownership-transfer flow.
export const assignableRoleSchema = z.enum(['admin', 'moderator']);

export async function requireOrgManage(ctx: any, args: { id?: string; slug?: string }) {
	const access = await verifyOrgAccess(ctx, { ...args, userId: ctx.userId });
	if (!access.organization) {
		throw new CRPCError({
			code: 'NOT_FOUND',
			message: 'Organization not found',
		});
	}
	if (!access.permissions.canDelete) {
		throw new CRPCError({
			code: 'FORBIDDEN',
			message: 'Only organization admins can manage members',
		});
	}
	return access;
}
