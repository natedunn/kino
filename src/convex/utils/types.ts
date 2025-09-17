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
