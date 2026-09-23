import type { QueryFunction, UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server';
import type { Id } from '../../../convex/native/_generated/dataModel';

import { convexQuery } from '@convex-dev/react-query';
import { useConvex } from 'convex/react';
import { getFunctionName } from 'convex/server';

import { api } from '../../../convex/native/_generated/api';

type Options<T> = Omit<UseQueryOptions<T>, 'queryFn'> & { queryFn?: QueryFunction<T> };
function read<TFunction extends FunctionReference<'query'>, TArgs>(
	fn: TFunction,
	args: (a: TArgs) => FunctionArgs<TFunction>
) {
	const queryOptions = (
		a: TArgs,
		extra?: { enabled?: boolean; skipUnauth?: boolean }
	): Options<FunctionReturnType<TFunction>> =>
		({
			...(extra?.enabled === false
				? { queryKey: ['convexQuery', getFunctionName(fn), 'skip'], enabled: false }
				: convexQuery(fn, args(a))),
		}) as Options<FunctionReturnType<TFunction>>;
	return { queryOptions, queryKey: (a: TArgs) => queryOptions(a).queryKey };
}
function write<TArgs, TResult>(mutationFn: (a: TArgs) => Promise<TResult>) {
	return { mutationOptions: (): UseMutationOptions<TResult, Error, TArgs> => ({ mutationFn }) };
}
const nativeReads = {
	project: {
		getDetails: read(api.projects.getBySlugs, (a: { orgSlug: string; slug: string }) => ({
			organizationSlug: a.orgSlug,
			projectSlug: a.slug,
		})),
		getGithubImportInfo: read(api.settings.githubImportInfo, (a: { id: string }) => ({
			id: a.id as Id<'projects'>,
		})),
	},
};
export const settingsServer = nativeReads;
export function useSettingsAPI() {
	const c = useConvex();
	return {
		project: {
			...nativeReads.project,
			update: write(
				(
					a: Omit<FunctionArgs<typeof api.settings.updateProject>, 'id' | 'urls'> & {
						id: string;
						urls: Array<{ source?: string; text: string; url: string }>;
					}
				) => c.mutation(api.settings.updateProject, { ...a, id: a.id as Id<'projects'> })
			),
		},
		projectExternal: {
			importGithubUrls: write((a: { id: string }) =>
				c.action(api.settingsActions.importGithubUrls, { id: a.id as Id<'projects'> })
			),
		},
	};
}
