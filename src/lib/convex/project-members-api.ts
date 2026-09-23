import type { QueryFunction, UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server';
import type { Id } from '../../../convex/native/_generated/dataModel';

import { convexQuery } from '@convex-dev/react-query';
import { useConvex } from 'convex/react';
import { getFunctionName } from 'convex/server';

import { api } from '../../../convex/native/_generated/api';
import { settingsServer } from './settings-api';

type Options<T> = Omit<UseQueryOptions<T>, 'queryFn'> & { queryFn?: QueryFunction<T> };
function read<TFunction extends FunctionReference<'query'>, TArgs>(
	fn: TFunction,
	args: (a: TArgs) => FunctionArgs<TFunction>
) {
	return {
		queryOptions: (
			a: TArgs,
			extra?: { enabled?: boolean }
		): Options<FunctionReturnType<TFunction>> =>
			({
				...(extra?.enabled === false
					? { queryKey: ['convexQuery', getFunctionName(fn), 'skip'], enabled: false }
					: convexQuery(fn, args(a))),
			}) as Options<FunctionReturnType<TFunction>>,
	};
}
function write<TArgs, TResult>(mutationFn: (a: TArgs) => Promise<TResult>) {
	return { mutationOptions: (): UseMutationOptions<TResult, Error, TArgs> => ({ mutationFn }) };
}
const projectArgs = (a: { projectId: string }) => ({ projectId: a.projectId as Id<'projects'> });
const nativeReads = {
	project: settingsServer.project,
	projectMember: { listProjectMembers: read(api.projectMembers.listProjectMembers, projectArgs) },
	projectAccess: { getManagementState: read(api.projectMembers.getManagementState, projectArgs) },
};
export const projectMembersServer = nativeReads;
export function useProjectMembersAPI() {
	const client = useConvex();
	return {
		project: nativeReads.project,
		projectMember: {
			...nativeReads.projectMember,
			inviteProjectMember: write((a: { projectId: string; email: string }) =>
				client.mutation(api.projectMembers.inviteProjectMember, { ...a, ...projectArgs(a) })
			),
			removeProjectMember: write((a: { projectMemberId: string }) =>
				client.mutation(api.projectMembers.removeProjectMember, {
					projectMemberId: a.projectMemberId as Id<'projectMembers'>,
				})
			),
		},
		projectAccess: {
			...nativeReads.projectAccess,
			setModeratorAccess: write((a: { projectId: string; memberId: string; enabled: boolean }) =>
				client.mutation(api.projectMembers.setModeratorAccess, {
					...a,
					...projectArgs(a),
					memberId: a.memberId as Id<'memberships'>,
				})
			),
		},
	};
}
