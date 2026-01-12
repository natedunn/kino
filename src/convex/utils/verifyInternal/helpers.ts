import {
	DataModelFromSchemaDefinition,
	GenericSchema,
	SchemaDefinition,
	TableNamesInDataModel,
} from 'convex/server';

/**
 * Get Table indexes helper
 *
 * Note: this is using an experimental API in convex-js
 * https://github.com/get-convex/convex-js/commit/04c3b44cab54c4d2230cce9312bdff074d54ab04
 */
export const getTableIndexes = <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
	TN extends TableNamesInDataModel<DataModel>,
>(
	schema: S,
	tableName: TN
) => {
	return schema.tables[tableName][' indexes']();
};
