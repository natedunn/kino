import { GenericDataModel, TableNamesInDataModel } from 'convex/server';
import * as z from 'zod';

import { zid } from '@/_modules/zod4';

export const SHARED_SCHEMA = <
	DataModel extends GenericDataModel,
	TableName extends TableNamesInDataModel<DataModel> = TableNamesInDataModel<DataModel>,
>(
	id: TableName
) => {
	return {
		_id: zid(id),
		_creationTime: z.number(),
		deletedTime: z.number().optional(),
		updatedTime: z.number().optional(),
	};
};
