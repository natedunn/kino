import type { QueryFunction, UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';

import { convexQuery } from '@convex-dev/react-query';
import { useConvex } from 'convex/react';

import { api } from '../../../convex/native/_generated/api';

type QueryOptions<T> = Omit<UseQueryOptions<T>, 'queryFn'> & { queryFn?: QueryFunction<T> };
export type OperationalJob = FunctionReturnType<typeof api.adminOperations.list>[number];

export function operationalJobReference(
	job: OperationalJob
): FunctionArgs<typeof api.adminOperations.resume> {
	switch (job.kind) {
		case 'storage_cleanup':
			return { job: { kind: job.kind, jobId: job.jobId } };
		case 'project_deletion':
			return { job: { kind: job.kind, jobId: job.jobId } };
		case 'feedback_deletion':
			return { job: { kind: job.kind, jobId: job.jobId } };
		case 'update_deletion':
			return { job: { kind: job.kind, jobId: job.jobId } };
		case 'storage_project_purge':
			return { job: { kind: job.kind, jobId: job.jobId } };
		case 'board_deletion':
			return { job: { kind: job.kind, jobId: job.jobId } };
	}
}

const nativeReads = {
	adminOperations: {
		getSystemMetrics: {
			queryOptions: (
				_args: Record<string, never>
			): QueryOptions<FunctionReturnType<typeof api.adminOperations.getSystemMetrics>> =>
				convexQuery(api.adminOperations.getSystemMetrics, {}),
		},
		list: {
			queryOptions: (
				_args: Record<string, never>
			): QueryOptions<FunctionReturnType<typeof api.adminOperations.list>> =>
				convexQuery(api.adminOperations.list, {}),
		},
		listAlerts: {
			queryOptions: (
				_args: Record<string, never>
			): QueryOptions<FunctionReturnType<typeof api.adminOperations.listAlerts>> =>
				convexQuery(api.adminOperations.listAlerts, {}),
		},
		listMaintenance: {
			queryOptions: (
				_args: Record<string, never>
			): QueryOptions<FunctionReturnType<typeof api.adminOperations.listMaintenance>> =>
				convexQuery(api.adminOperations.listMaintenance, {}),
		},
	},
};

export const adminOperationsServer = nativeReads;

export function useAdminOperationsAPI() {
	const convex = useConvex();
	const mutationOptions = <TArgs, TResult>(
		mutation: (args: TArgs) => Promise<TResult>,
		options?: Omit<UseMutationOptions<TResult, Error, TArgs>, 'mutationFn'>
	): UseMutationOptions<TResult, Error, TArgs> => ({ ...options, mutationFn: mutation });
	return {
		...nativeReads,
		adminOperations: {
			...nativeReads.adminOperations,
			resume: {
				mutationOptions: (
					options?: Omit<
						UseMutationOptions<
							FunctionReturnType<typeof api.adminOperations.resume>,
							Error,
							FunctionArgs<typeof api.adminOperations.resume>
						>,
						'mutationFn'
					>
				): UseMutationOptions<
					FunctionReturnType<typeof api.adminOperations.resume>,
					Error,
					FunctionArgs<typeof api.adminOperations.resume>
				> => ({
					...options,
					mutationFn: (args) => convex.mutation(api.adminOperations.resume, args),
				}),
			},
			startMaintenance: {
				mutationOptions: (
					options?: Omit<
						UseMutationOptions<
							FunctionReturnType<typeof api.adminOperations.startMaintenance>,
							Error,
							FunctionArgs<typeof api.adminOperations.startMaintenance>
						>,
						'mutationFn'
					>
				) =>
					mutationOptions(
						(args: FunctionArgs<typeof api.adminOperations.startMaintenance>) =>
							convex.mutation(api.adminOperations.startMaintenance, args),
						options
					),
			},
			resumeMaintenance: {
				mutationOptions: (
					options?: Omit<
						UseMutationOptions<
							FunctionReturnType<typeof api.adminOperations.resumeMaintenance>,
							Error,
							FunctionArgs<typeof api.adminOperations.resumeMaintenance>
						>,
						'mutationFn'
					>
				) =>
					mutationOptions(
						(args: FunctionArgs<typeof api.adminOperations.resumeMaintenance>) =>
							convex.mutation(api.adminOperations.resumeMaintenance, args),
						options
					),
			},
		},
	};
}
