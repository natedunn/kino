import type { QueryClient } from '@tanstack/react-query';
import type { Id } from '../../../convex/native/_generated/dataModel';

import { convexQuery } from '@convex-dev/react-query';

import { api } from '../../../convex/native/_generated/api';

/**
 * A private organization or project can become visible after an invitation is
 * accepted in the same tab. Convex query options have an infinite stale time,
 * so ensureQueryData would otherwise keep a cached null and route to a false 404.
 * Only retry an already-cached miss; a first request should query just once.
 */
export async function getOrganizationForRoute(queryClient: QueryClient, slug: string) {
	const options = convexQuery(api.organizations.getBySlug, { slug });
	const cached = queryClient.getQueryData(options.queryKey);
	if (cached === null) {
		return queryClient.fetchQuery({ ...options, staleTime: 0 });
	}
	return queryClient.ensureQueryData(options);
}

export async function getProjectForRoute(
	queryClient: QueryClient,
	params: { org: string; project: string }
) {
	const options = convexQuery(api.projects.getBySlugs, {
		organizationSlug: params.org,
		projectSlug: params.project,
	});
	const cached = queryClient.getQueryData(options.queryKey);
	if (cached === null) {
		return queryClient.fetchQuery({ ...options, staleTime: 0 });
	}
	return queryClient.ensureQueryData(options);
}

export async function getProjectOverviewForRoute(
	queryClient: QueryClient,
	projectId: Id<'projects'>
) {
	const options = convexQuery(api.projectOverview.get, { projectId });
	const cached = queryClient.getQueryData(options.queryKey);
	if (cached === null) {
		return queryClient.fetchQuery({ ...options, staleTime: 0 });
	}
	return queryClient.ensureQueryData(options);
}
