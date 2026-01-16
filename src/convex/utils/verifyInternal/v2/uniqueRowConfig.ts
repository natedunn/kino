import {
	DataModelFromSchemaDefinition,
	DocumentByName,
	GenericMutationCtx,
	GenericSchema,
	SchemaDefinition,
	TableNamesInDataModel,
	WithoutSystemFields,
} from 'convex/server';

import { UniqueRowConfigData } from './types';

export const uniqueRowConfig = <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
	const C extends UniqueRowConfigData<DataModel>,
>(
	_schema: S,
	config: C
) => {
	/**
	 * Verify uniqueness - throws if not unique
	 * Returns the data unchanged if unique
	 */
	const verify = async <TN extends TableNamesInDataModel<DataModel>>(
		ctx: Omit<GenericMutationCtx<DataModel>, never>,
		tableName: TN,
		data: WithoutSystemFields<DocumentByName<DataModel, TN>>
	): Promise<WithoutSystemFields<DocumentByName<DataModel, TN>>> => {
		// Implementation would check uniqueness here
		// For now, just return the data
		const tableConfig = config[tableName];
		if (tableConfig) {
			// TODO: Implement actual uniqueness check
			console.log(`Checking uniqueness for ${String(tableName)}...`);
		}
		return data;
	};

	return {
		_type: 'uniqueRow' as const,
		verify,
		config: config as C,
	};
};
