import type { Id } from '../../../convex/native/_generated/dataModel';

import { convexQuery } from '@convex-dev/react-query';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../../convex/native/_generated/api';
import { convexQueryKeyHashFn } from './query-client';
import {
	getOrganizationForRoute,
	getProjectForRoute,
	getProjectOverviewForRoute,
} from './route-visibility-query';

const params = { org: 'private-org', project: 'private-project' };
const projectQuery = convexQuery(api.projects.getBySlugs, {
	organizationSlug: params.org,
	projectSlug: params.project,
});
const visibleProject = { project: { id: 'visible-project' } };

function makeQueryClient(queryFn: () => Promise<unknown>) {
	return new QueryClient({
		defaultOptions: {
			queries: { queryFn, queryKeyHashFn: convexQueryKeyHashFn, retry: false },
		},
	});
}

afterEach(() => vi.restoreAllMocks());

describe('getProjectForRoute', () => {
	it('refreshes a cached private-project miss after access is granted', async () => {
		const queryFn = vi.fn(async () => visibleProject);
		const queryClient = makeQueryClient(queryFn);
		queryClient.setQueryData(projectQuery.queryKey, null);

		await expect(getProjectForRoute(queryClient, params)).resolves.toEqual(visibleProject);
		expect(queryFn).toHaveBeenCalledTimes(1);
	});

	it('does not duplicate a first request that still cannot see the project', async () => {
		const queryFn = vi.fn(async () => null);
		const queryClient = makeQueryClient(queryFn);

		await expect(getProjectForRoute(queryClient, params)).resolves.toBeNull();
		expect(queryFn).toHaveBeenCalledTimes(1);
	});

	it('keeps a cached visible project without another request', async () => {
		const queryFn = vi.fn(async () => null);
		const queryClient = makeQueryClient(queryFn);
		queryClient.setQueryData(projectQuery.queryKey, visibleProject);

		await expect(getProjectForRoute(queryClient, params)).resolves.toEqual(visibleProject);
		expect(queryFn).not.toHaveBeenCalled();
	});

	it('refreshes a cached overview miss after access is granted', async () => {
		const projectId = 'visible-project' as Id<'projects'>;
		const overviewQuery = convexQuery(api.projectOverview.get, { projectId });
		const overview = { stats: { feedback: 1 } };
		const queryFn = vi.fn(async () => overview);
		const queryClient = makeQueryClient(queryFn);
		queryClient.setQueryData(overviewQuery.queryKey, null);

		await expect(getProjectOverviewForRoute(queryClient, projectId)).resolves.toEqual(overview);
		expect(queryFn).toHaveBeenCalledTimes(1);
	});
});

describe('getOrganizationForRoute', () => {
	it('refreshes a cached private-organization miss after access is granted', async () => {
		const queryFn = vi.fn(async () => ({ name: 'Private org' }));
		const queryClient = makeQueryClient(queryFn);
		const options = convexQuery(api.organizations.getBySlug, { slug: params.org });
		queryClient.setQueryData(options.queryKey, null);

		await expect(getOrganizationForRoute(queryClient, params.org)).resolves.toEqual({
			name: 'Private org',
		});
		expect(queryFn).toHaveBeenCalledTimes(1);
	});
});
