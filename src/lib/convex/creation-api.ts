import type { QueryFunction, UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import type { FunctionReturnType } from 'convex/server';

import { convexQuery } from '@convex-dev/react-query';
import { useConvex } from 'convex/react';

import { api } from '../../../convex/native/_generated/api';

type Extra = { enabled?: boolean; skipUnauth?: boolean };
type QueryOptions<TQueryFnData, TData = TQueryFnData> = Omit<
	UseQueryOptions<TQueryFnData, Error, TData>,
	'queryFn'
> & { queryFn?: QueryFunction<TQueryFnData> };

type NativeOrganization = NonNullable<FunctionReturnType<typeof api.organizations.getBySlug>>;
type NativeOrganizations = FunctionReturnType<typeof api.organizations.listMine>;
type OrganizationDetails = {
	org: Pick<NativeOrganization, 'id' | 'logo' | 'name' | 'slug' | 'visibility'>;
	permissions: { canCreate: boolean };
};

type OrganizationList = { teams: NativeOrganizations; underLimit: boolean };
type ProjectPermission = { canAddProjects: boolean };

export function canCreateProjectInOrganization(
	value:
		| {
				permissions: { canCreate?: boolean; canCreateProjects?: boolean };
		  }
		| null
		| undefined
) {
	return value?.permissions.canCreate ?? value?.permissions.canCreateProjects ?? false;
}

function skipped<TQueryFnData, TData = TQueryFnData>(): QueryOptions<TQueryFnData, TData> {
	return { enabled: false, queryKey: ['convexQuery', 'creation', 'skip'] };
}

const nativeReads = {
	org: {
		findMyOrgs: {
			queryOptions: (
				_args: Record<string, never>,
				extra?: Extra
			): QueryOptions<OrganizationList> => {
				if (extra?.enabled === false) return skipped<OrganizationList>();
				return convexQuery(api.organizations.listMineForRoute, {});
			},
		},
		getDetails: {
			queryOptions: (
				args: { slug: string },
				extra?: Extra
			): QueryOptions<
				FunctionReturnType<typeof api.organizations.getBySlug>,
				null | OrganizationDetails
			> => {
				if (extra?.enabled === false)
					return skipped<
						FunctionReturnType<typeof api.organizations.getBySlug>,
						null | OrganizationDetails
					>();
				const options = convexQuery(api.organizations.getBySlug, args);
				return {
					...options,
					select: (
						organization: FunctionReturnType<typeof api.organizations.getBySlug>
					): null | OrganizationDetails =>
						organization
							? {
									org: organization,
									permissions: {
										canCreate: organization.permissions.canCreateProjects,
									},
								}
							: null,
				};
			},
		},
		getMyPermission: {
			queryOptions: (
				args: { slug: string },
				extra?: Extra
			): QueryOptions<
				FunctionReturnType<typeof api.policy.getMyProjectCreationPermission>,
				ProjectPermission
			> => {
				if (extra?.enabled === false)
					return skipped<
						FunctionReturnType<typeof api.policy.getMyProjectCreationPermission>,
						ProjectPermission
					>();
				return convexQuery(api.policy.getMyProjectCreationPermission, { orgSlug: args.slug });
			},
		},
	},
};

export const creationServer = nativeReads;

function write<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
	return {
		mutationOptions: (
			options?: Omit<UseMutationOptions<TResult, Error, TArgs>, 'mutationFn'>
		): UseMutationOptions<TResult, Error, TArgs> => ({ ...options, mutationFn }),
	};
}

export function useCreationAPI() {
	const convex = useConvex();
	return {
		...nativeReads,
		org: {
			...nativeReads.org,
			create: write(
				(args: { logo?: string; name: string; slug?: string; visibility: 'public' | 'private' }) =>
					convex.mutation(api.organizations.createForRoute, {
						name: args.name,
						slug: args.slug,
						visibility: args.visibility,
					})
			),
		},
		project: {
			create: write(
				(args: { name: string; orgSlug: string; slug: string; visibility: 'public' | 'private' }) =>
					convex.mutation(api.policy.createProjectForRoute, args)
			),
		},
	};
}
