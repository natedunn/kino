import type { ProjectThemePalette, ProjectThemePresetId } from '@convex/project-theme';
import type { QueryFunction, UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server';
import type { Id } from '../../../convex/native/_generated/dataModel';

import { convexQuery } from '@convex-dev/react-query';
import { useConvex } from 'convex/react';
import { getFunctionName } from 'convex/server';

import { api } from '../../../convex/native/_generated/api';

type QueryOptions<T> = Omit<UseQueryOptions<T>, 'queryFn'> & { queryFn?: QueryFunction<T> };
type Extra = { enabled?: boolean; skipUnauth?: boolean; subscribe?: boolean };

function read<TFunction extends FunctionReference<'query'>, TArgs>(
	fn: TFunction,
	args: (value: TArgs) => FunctionArgs<TFunction>
) {
	const queryOptions = (value: TArgs, extra?: Extra): QueryOptions<FunctionReturnType<TFunction>> =>
		({
			...(extra?.enabled === false
				? { queryKey: ['convexQuery', getFunctionName(fn), 'skip'], enabled: false }
				: convexQuery(fn, args(value))),
			...(extra?.enabled === undefined ? {} : { enabled: extra.enabled }),
		}) as QueryOptions<FunctionReturnType<TFunction>>;
	return { queryOptions, staticQueryOptions: queryOptions };
}

function write<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
	return {
		mutationOptions: (
			options?: Omit<UseMutationOptions<TResult, Error, TArgs>, 'mutationFn'>
		): UseMutationOptions<TResult, Error, TArgs> => ({ ...options, mutationFn }),
	};
}

type PublishInput = {
	dark: ProjectThemePalette;
	expectedPublishedRevision: number;
	light: ProjectThemePalette;
	presetId: ProjectThemePresetId;
	projectId: Id<'projects'>;
};

const nativeAppearanceReads = {
	project: {
		getDetails: read(api.projects.getBySlugs, (args: { orgSlug: string; slug: string }) => ({
			organizationSlug: args.orgSlug,
			projectSlug: args.slug,
		})),
	},
	projectTheme: {
		getEditorState: read(api.projectAppearance.getEditorState, (args: { projectId: string }) => ({
			projectId: args.projectId as Id<'projects'>,
		})),
	},
};

export const appearanceServer = nativeAppearanceReads;

export function useAppearanceAPI() {
	const convex = useConvex();
	return {
		...nativeAppearanceReads,
		projectTheme: {
			...nativeAppearanceReads.projectTheme,
			publish: write((args: Omit<PublishInput, 'projectId'> & { projectId: string }) =>
				convex.mutation(api.projectAppearance.publish, {
					...args,
					projectId: args.projectId as Id<'projects'>,
				})
			),
		},
	};
}

export function useOrganizationAppearanceAPI() {
	const convex = useConvex();
	return {
		generateLogoUploadUrl: write((args: { organizationId: string }) =>
			convex.mutation(api.organizationAppearance.generateLogoUploadUrl, {
				organizationId: args.organizationId as Id<'organizations'>,
			})
		),
		commitLogo: write((args: { organizationId: string; storageId: string; uploadToken: string }) =>
			convex.mutation(api.organizationAppearance.commitLogo, {
				organizationId: args.organizationId as Id<'organizations'>,
				storageId: args.storageId as Id<'_storage'>,
				uploadToken: args.uploadToken,
			})
		),
	};
}
