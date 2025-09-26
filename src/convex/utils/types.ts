import { api } from '@convex/betterAuth/_generated/api';
import {
	GenericActionCtx,
	GenericMutationCtx,
	GenericQueryCtx,
	PaginationResult,
} from 'convex/server';

import { DataModel } from '../_generated/dataModel';

export type GenericCtx =
	| GenericQueryCtx<DataModel>
	| GenericActionCtx<DataModel>
	| GenericMutationCtx<DataModel>;

export type UnwrapPaginationResult<T> = T extends PaginationResult<infer U> ? U : never;

export type BetterAuthApi = {
	[K in keyof typeof api]: {
		[P in keyof (typeof api)[K]]: (typeof api)[K][P] extends {
			_returnType: infer R;
		}
			? R
			: never;
	};
};
