import { createAccessControl } from 'better-auth/plugins/access';
import {
	adminAc,
	defaultStatements,
	memberAc,
	ownerAc,
} from 'better-auth/plugins/organization/access';

/**
 * Organization access-control roles, shared by the better-auth server config
 * (convex/functions/auth.ts) and the client (src/lib/convex/auth-client.ts).
 *
 * Content-level authorization is still enforced by the app's own
 * verifyOrgAccess / verifyProjectAccess helpers. The purpose of registering
 * roles here is to make them FIRST-CLASS, ASSIGNABLE better-auth roles — in
 * particular `moderator`, which better-auth would otherwise reject when creating
 * an invitation (createInvitation validates the role name against this set).
 *
 * `editor` remains registered only for the compatibility deploy so pending
 * legacy invitations can still be accepted while the migration runs.
 */
const statement = { ...defaultStatements } as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({ ...ownerAc.statements });
export const admin = ac.newRole({ ...adminAc.statements });
// Moderator authority is enforced by explicit project assignments in Kino.
// Better Auth grants moderators no organization-management permissions.
export const moderator = ac.newRole({ ...memberAc.statements });
// Legacy compatibility only; remove after member/invitation migration.
export const editor = ac.newRole({ ...memberAc.statements });
export const member = ac.newRole({ ...memberAc.statements });

export const roles = { admin, editor, member, moderator, owner };
