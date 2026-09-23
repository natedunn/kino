import type { QueryFunction, UseQueryOptions } from '@tanstack/react-query';
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server';

import { convexQuery } from '@convex-dev/react-query';
import { useConvex } from 'convex/react';
import { getFunctionName } from 'convex/server';

import { api } from '../../../convex/native/_generated/api';

type Options<T> = Omit<UseQueryOptions<T>, 'queryFn'> & { queryFn?: QueryFunction<T> };
type Extra = { enabled?: boolean; skipUnauth?: boolean };

function read<TFunction extends FunctionReference<'query'>, TArgs>(
	fn: TFunction,
	args: (value: TArgs) => FunctionArgs<TFunction>
) {
	const queryOptions = (value: TArgs, extra?: Extra): Options<FunctionReturnType<TFunction>> =>
		({
			...(extra?.enabled === false
				? { queryKey: ['convexQuery', getFunctionName(fn), 'skip'], enabled: false }
				: convexQuery(fn, args(value))),
		}) as Options<FunctionReturnType<TFunction>>;

	return { queryOptions };
}

const nativeReads = {
	userDataExport: {
		getAvailableSections: read(api.userDataExport.getAvailableSections, () => ({})),
	},
};

export type ExportSection = FunctionReturnType<
	typeof api.userDataExport.getAvailableSections
>[number];
export type ExportSectionId = ExportSection['id'];
export type ExportDocument = FunctionReturnType<typeof api.userDataExport.exportData>;

export const userDataExportServer = nativeReads;

export function useUserDataExportAPI() {
	const convex = useConvex();

	return {
		userDataExport: {
			...nativeReads.userDataExport,
			exportData: {
				query: (args: FunctionArgs<typeof api.userDataExport.exportData>) =>
					convex.query(api.userDataExport.exportData, args),
			},
		},
	};
}
