import type { QueryFunction, UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server';
import type { Value } from 'convex/values';
import type { Id } from '../../../convex/native/_generated/dataModel';

import { convexQuery } from '@convex-dev/react-query';
import { useConvex } from 'convex/react';
import { getFunctionName, makeFunctionReference } from 'convex/server';

import { api } from '../../../convex/native/_generated/api';

type Options<T> = Omit<UseQueryOptions<T>, 'queryFn'> & { queryFn?: QueryFunction<T> };
type Extra = { enabled?: boolean; skipUnauth?: boolean; subscribe?: boolean };
function read<TFunction extends FunctionReference<'query'>, TArgs>(
	fn: TFunction,
	args: (a: TArgs) => FunctionArgs<TFunction>
) {
	const queryOptions = (a: TArgs, extra?: Extra): Options<FunctionReturnType<TFunction>> =>
		({
			...(extra?.enabled === false
				? { queryKey: ['convexQuery', getFunctionName(fn), 'skip'], enabled: false }
				: convexQuery(fn, args(a))),
			...(extra?.enabled === undefined ? {} : { enabled: extra.enabled }),
		}) as Options<FunctionReturnType<TFunction>>;
	return {
		queryOptions,
		staticQueryOptions: queryOptions,
		queryKey: (a: TArgs) => queryOptions(a).queryKey,
	};
}
function write<TArgs, TResult>(mutationFn: (a: TArgs) => Promise<TResult>) {
	return {
		mutationOptions: (
			options?: Omit<UseMutationOptions<TResult, Error, TArgs>, 'mutationFn'>
		): UseMutationOptions<TResult, Error, TArgs> => ({ ...options, mutationFn }),
	};
}
type Category = FunctionArgs<typeof api.updates.save>['category'];
type List = {
	projectId: string;
	cursor: string | null;
	limit?: number;
	category?: Category;
	search?: string;
};
const listing = (a: List) => ({
	projectId: a.projectId as Id<'projects'>,
	category: a.category,
	search: a.search,
	paginationOpts: { cursor: a.cursor, numItems: a.limit ?? 10 },
});
const detail = (a: { projectId: string; slug: string }) => ({
	...a,
	projectId: a.projectId as Id<'projects'>,
});
export const nativeUpdatesReads = {
	project: {
		getDetails: read(api.projects.getBySlugs, (a: { orgSlug: string; slug: string }) => ({
			organizationSlug: a.orgSlug,
			projectSlug: a.slug,
		})),
	},
	profile: { findMyProfile: read(api.profiles.me, (_a: Record<string, never>) => ({})) },
	update: {
		listByProject: read(api.updatesWorkspace.list, listing),
		searchProject: read(api.updatesWorkspace.list, listing),
		listProjectDashboard: read(api.updatesWorkspace.list, (a: List) => ({
			...listing(a),
			management: true,
		})),
		listFeatured: read(api.updatesWorkspace.featured, (a: { projectId: string }) => ({
			projectId: a.projectId as Id<'projects'>,
		})),
		getBySlug: read(api.updatesWorkspace.detail, detail),
		getDetailCritical: read(api.updatesWorkspace.detail, detail),
		getDetailInteractive: read(
			api.updatesWorkspace.interactive,
			(a: { projectId: string; updateId: string }) => ({
				projectId: a.projectId as Id<'projects'>,
				updateId: a.updateId as Id<'updates'>,
			})
		),
		getMiddleComments: read(
			api.updatesWorkspace.middleComments,
			(a: {
				updateId: string;
				cursor: string;
				limit?: number;
				tailCommentIds?: Array<string>;
			}) => ({
				...a,
				updateId: a.updateId as Id<'updates'>,
			})
		),
	},
	feedback: {
		searchForLinking: read(
			api.updatesWorkspace.searchFeedback,
			(a: { projectId: string; search?: string }) => ({
				...a,
				projectId: a.projectId as Id<'projects'>,
			})
		),
		getByIds: read(api.updatesWorkspace.feedbackByIds, (a: { ids: Array<string> }) => ({
			ids: a.ids as Array<Id<'feedback'>>,
		})),
	},
};
export const updatesServer = nativeUpdatesReads;
type Edit = {
	title?: string;
	content?: string;
	tags?: Array<string>;
	category?: Category;
	featured?: boolean;
	relatedFeedbackIds?: Array<string>;
};
export function useUpdatesAPI() {
	const c = useConvex();
	const snapshotRead = <TArgs, T>(entry: {
		queryOptions: (a: TArgs, extra?: Extra) => Options<T>;
		staticQueryOptions: (a: TArgs, extra?: Extra) => Options<T>;
		queryKey: (a: TArgs) => Options<T>['queryKey'];
	}) => ({
		...entry,
		staticQueryOptions: (a: TArgs): Options<T> => {
			const options = entry.queryOptions(a);
			const [, name, args] = options.queryKey;
			return {
				...options,
				queryKey: ['native-update-snapshot', name, args],
				staleTime: 0,
				queryFn: () =>
					c.query(
						makeFunctionReference<'query', Record<string, Value>, T>(name as string),
						args as Record<string, Value>
					),
			};
		},
	});
	const status = (a: { id: string }, status: 'draft' | 'published') =>
		c.mutation(api.updatesWorkspace.changeStatus, { id: a.id as Id<'updates'>, status });
	const bulk = (a: { projectId: string; ids: Array<string> }) => ({
		projectId: a.projectId as Id<'projects'>,
		ids: a.ids as Array<Id<'updates'>>,
	});
	return {
		...nativeUpdatesReads,
		update: {
			...nativeUpdatesReads.update,
			listByProject: snapshotRead(nativeUpdatesReads.update.listByProject),
			searchProject: snapshotRead(nativeUpdatesReads.update.searchProject),
			getMiddleComments: snapshotRead(nativeUpdatesReads.update.getMiddleComments),
			create: write(async (a: Edit & { projectId: string; title: string; content: string }) => {
				const result = await c.mutation(api.updates.save, {
					projectId: a.projectId as Id<'projects'>,
					title: a.title,
					content: a.content,
					category: a.category ?? 'changelog',
					featured: a.featured ?? false,
					tags: a.tags ?? [],
					relatedFeedbackIds: (a.relatedFeedbackIds ?? []) as Array<Id<'feedback'>>,
				});
				return { slug: result.slug, updateId: result.id };
			}),
			update: write((a: Edit & { id: string }) =>
				c.mutation(api.updatesWorkspace.change, {
					...a,
					id: a.id as Id<'updates'>,
					relatedFeedbackIds: a.relatedFeedbackIds as Array<Id<'feedback'>> | undefined,
				})
			),
			publish: write((a: { id: string }) => status(a, 'published')),
			unpublish: write((a: { id: string }) => status(a, 'draft')),
			remove: write((a: { id: string }) =>
				c.mutation(api.updatesWorkspace.remove, { id: a.id as Id<'updates'> })
			),
			bulkPublish: write((a: { projectId: string; ids: Array<string> }) =>
				c.mutation(api.updates.changeStatus, { ...bulk(a), status: 'published' })
			),
			bulkUnpublish: write((a: { projectId: string; ids: Array<string> }) =>
				c.mutation(api.updates.changeStatus, { ...bulk(a), status: 'draft' })
			),
			bulkRemove: write((a: { projectId: string; ids: Array<string> }) =>
				c.mutation(api.updates.remove, bulk(a))
			),
		},
		updateComment: {
			create: write((a: { updateId: string; content: string; replyUpdateCommentId?: string }) =>
				c.mutation(api.updates.saveComment, {
					updateId: a.updateId as Id<'updates'>,
					content: a.content,
					replyCommentId: a.replyUpdateCommentId as Id<'updateComments'> | undefined,
				})
			),
			update: write((a: { _id: string; content: string }) =>
				c.mutation(api.updatesWorkspace.changeComment, {
					content: a.content,
					id: a._id as Id<'updateComments'>,
				})
			),
			remove: write((a: { _id: string }) =>
				c.mutation(api.updates.removeComment, { id: a._id as Id<'updateComments'> })
			),
		},
		updateCommentEmote: {
			toggle: write((a: { updateId: string; updateCommentId: string; content: string }) =>
				c.mutation(api.updatesWorkspace.toggleComment, {
					content: a.content,
					updateCommentId: a.updateCommentId as Id<'updateComments'>,
				})
			),
		},
		updateEmote: {
			toggle: write((a: { updateId: string; content: 'heart' }) =>
				c.mutation(api.updates.toggleReaction, { ...a, updateId: a.updateId as Id<'updates'> })
			),
		},
	};
}
