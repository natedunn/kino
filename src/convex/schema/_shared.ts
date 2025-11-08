import { zid } from 'convex-helpers/server/zod4';
import { GenericDataModel, TableNamesInDataModel } from 'convex/server';
import { z } from 'zod';

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
