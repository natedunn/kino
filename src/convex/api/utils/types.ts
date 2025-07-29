import { customAction, customMutation, customQuery } from 'convex-helpers/server/customFunctions';
import { zCustomAction, zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod';
import {
	GenericActionCtx,
	GenericMutationCtx,
	GenericQueryCtx,
	PaginationResult,
} from 'convex/server';

import { DataModel } from '../../_generated/dataModel';

export type GenericCtx =
	| GenericQueryCtx<DataModel>
	| GenericActionCtx<DataModel>
	| GenericMutationCtx<DataModel>;

export type Procedure = {
	external: {
		query: ReturnType<typeof zCustomQuery>;
		mutation: ReturnType<typeof zCustomMutation>;
		action: ReturnType<typeof zCustomAction>;
	};
	internal: {
		query: ReturnType<typeof zCustomQuery>;
		mutation: ReturnType<typeof zCustomMutation>;
		action: ReturnType<typeof zCustomAction>;
	};
	_convex: {
		external: {
			query: ReturnType<typeof customQuery>;
			mutation: ReturnType<typeof customMutation>;
			action: ReturnType<typeof customAction>;
		};
		internal: {
			query: ReturnType<typeof customQuery>;
			mutation: ReturnType<typeof customMutation>;
			action: ReturnType<typeof customAction>;
		};
	};
};

export type UnwrapPaginationResult<T> = T extends PaginationResult<infer U> ? U : never;
