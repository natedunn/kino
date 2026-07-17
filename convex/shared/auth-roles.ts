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
 * particular `editor`, which better-auth would otherwise reject when creating
 * an invitation (createInvitation validates the role name against this set).
 *
 * Role set (below system admin): owner / admin / editor / member.
 */
const statement = { ...defaultStatements } as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({ ...ownerAc.statements });
export const admin = ac.newRole({ ...adminAc.statements });
// `editor` sits between admin and member: it can edit project content (enforced
// by verify*Access), but has no org-management rights beyond a plain member.
export const editor = ac.newRole({ ...memberAc.statements });
export const member = ac.newRole({ ...memberAc.statements });

export const roles = { admin, editor, member, owner };
