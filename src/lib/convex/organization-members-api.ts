import type { UseMutationOptions } from '@tanstack/react-query';
import type { Id } from '../../../convex/native/_generated/dataModel';

import { convexQuery } from '@convex-dev/react-query';
import { useConvex } from 'convex/react';

import { api } from '../../../convex/native/_generated/api';

function write<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
	return { mutationOptions: (): UseMutationOptions<TResult, Error, TArgs> => ({ mutationFn }) };
}
type OrgArgs = { slug: string; organizationId?: string };
type Extra = { enabled?: boolean; skipUnauth?: boolean };
const orgId = (args: OrgArgs, extra?: Extra) =>
	args.organizationId && extra?.enabled !== false
		? { organizationId: args.organizationId as Id<'organizations'> }
		: 'skip';

export function useOrganizationMembersAPI() {
	const c = useConvex();
	return {
		org: {
			getDetails: {
				queryOptions: (args: { slug: string }, extra?: Extra) => ({
					...convexQuery(api.organizations.getBySlug, extra?.enabled === false ? 'skip' : args),
					select: (
						data: Awaited<ReturnType<typeof c.query<typeof api.organizations.getBySlug>>>
					) => (data ? { org: data, permissions: data.permissions } : null),
				}),
			},
		},
		project: {
			getManyByOrg: {
				queryOptions: (
					args: { orgSlug: string; organizationId?: string; limit: number },
					extra?: Extra
				) =>
					convexQuery(
						api.projects.listByOrganization,
						args.organizationId && extra?.enabled !== false
							? { organizationId: args.organizationId as Id<'organizations'>, limit: args.limit }
							: 'skip'
					),
			},
		},
		orgMember: {
			listMembers: {
				queryOptions: (args: OrgArgs, extra?: Extra) =>
					convexQuery(api.organizations.listMembers, orgId(args, extra)),
			},
			listPendingInvitations: {
				queryOptions: (args: OrgArgs, extra?: Extra) =>
					convexQuery(api.invitations.listPending, orgId(args, extra)),
			},
			getModeratorProjectAccess: {
				queryOptions: (args: { memberId: string }) =>
					convexQuery(api.organizationMembers.getModeratorProjectAccess, {
						memberId: args.memberId as Id<'memberships'>,
					}),
			},
			inviteMember: write(
				(args: {
					organizationId: string;
					email: string;
					role: 'admin' | 'moderator';
					projectIds?: Array<string>;
					origin: string;
				}) =>
					c.mutation(api.invitations.create, {
						organizationId: args.organizationId as Id<'organizations'>,
						email: args.email,
						role: args.role,
						projectIds: (args.projectIds ?? []) as Array<Id<'projects'>>,
					})
			),
			updateMemberRole: write(
				(args: { memberId: string; role: 'admin' | 'moderator'; projectIds?: Array<string> }) =>
					c.mutation(api.organizations.setMemberRole, {
						membershipId: args.memberId as Id<'memberships'>,
						role: args.role,
						projectIds: (args.projectIds ?? []) as Array<Id<'projects'>>,
					})
			),
			removeMember: write((args: { memberId: string }) =>
				c.mutation(api.organizations.removeMember, {
					membershipId: args.memberId as Id<'memberships'>,
				})
			),
			cancelInvitation: write((args: { invitationId: string }) =>
				c.mutation(api.invitations.cancel, { invitationId: args.invitationId as Id<'invitations'> })
			),
			setModeratorProjectAccess: write((args: { memberId: string; projectIds: Array<string> }) =>
				c.mutation(api.organizationMembers.setModeratorProjectAccess, {
					memberId: args.memberId as Id<'memberships'>,
					projectIds: args.projectIds as Array<Id<'projects'>>,
				})
			),
		},
	};
}
