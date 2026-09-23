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
	const queryOptions = (
		a: TArgs,
		extra?: { enabled?: boolean }
	): Options<FunctionReturnType<TFunction>> =>
		({
			...(extra?.enabled === false
				? { queryKey: ['convexQuery', getFunctionName(fn), 'skip'], enabled: false }
				: convexQuery(fn, args(a))),
		}) as Options<FunctionReturnType<TFunction>>;
	return { queryOptions };
}
function write<TArgs, TResult>(mutationFn: (a: TArgs) => Promise<TResult>) {
	return {
		mutationOptions: (
			options?: Omit<UseMutationOptions<TResult, Error, TArgs>, 'mutationFn'>
		): UseMutationOptions<TResult, Error, TArgs> => ({ ...options, mutationFn }),
	};
}
const nativeReads = {
	project: { getDetails: settingsServer.project.getDetails },
	feedbackBoard: {
		listProjectBoards: read(api.feedbackBoards.list, (a: { projectId?: string }) => ({
			projectId: a.projectId as Id<'projects'>,
		})),
		get: read(
			api.feedbackBoards.get,
			(a: { id: string; orgSlug: string; projectSlug: string }) => ({
				...a,
				id: a.id as Id<'feedbackBoards'>,
			})
		),
	},
};
export const boardsServer = nativeReads;
export function useBoardsAPI() {
	const c = useConvex();
	return {
		...nativeReads,
		feedbackBoard: {
			...nativeReads.feedbackBoard,
			create: write(
				(
					a: Omit<FunctionArgs<typeof api.feedbackBoards.create>, 'projectId'> & {
						projectId: string;
					}
				) =>
					c.mutation(api.feedbackBoards.create, { ...a, projectId: a.projectId as Id<'projects'> })
			),
			update: write(
				(a: Omit<FunctionArgs<typeof api.feedbackBoards.update>, 'id'> & { id: string }) =>
					c.mutation(api.feedbackBoards.update, { ...a, id: a.id as Id<'feedbackBoards'> })
			),
			remove: write((a: { boardId: string; projectId: string }) =>
				c.mutation(api.feedbackBoards.remove, {
					boardId: a.boardId as Id<'feedbackBoards'>,
					projectId: a.projectId as Id<'projects'>,
				})
			),
		},
	};
}
