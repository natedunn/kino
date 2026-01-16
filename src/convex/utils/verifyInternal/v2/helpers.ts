import {
	DataModelFromSchemaDefinition,
	DocumentByName,
	GenericSchema,
	SchemaDefinition,
	TableNamesInDataModel,
} from 'convex/server';

import { UniqueRowConfigData } from './types';

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

/**
 * Generate column data from fields and data object
 */
export const constructColumnData = <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
	TN extends TableNamesInDataModel<DataModel>,
	D extends Partial<DocumentByName<DataModel, TN>>,
>(
	fields: string[],
	data: D,
	{
		allowNullishValue = false,
		allOrNothing = true,
	}: {
		allowNullishValue?: boolean;
		allOrNothing?: boolean;
	}
) => {
	const lengthOfFields = fields.length;

	const columnData = fields
		.map((_, index) => {
			const column = fields?.[index];
			const value = data?.[column];

			if (!column || (!allowNullishValue && !value)) {
				return;
			}

			return {
				column,
				value,
			};
		})
		.filter((e) => !!e);

	if (allOrNothing && columnData.length !== lengthOfFields) {
		console.warn(
			'The index was NOT supplied with the same amount data as there was fields. This warning only appears when setting `allOrNothing` to `true`.',
			'`fields: `',
			fields,
			'`columnData: `',
			columnData
		);
		return null;
	}

	return columnData.length > 0 ? columnData : null;
};

/**
 * Construct index data from schema and config
 */
export const constructIndexData = <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
	TN extends TableNamesInDataModel<DataModel>,
>(
	schema: S,
	tableName: TN,
	indexConfig?: UniqueRowConfigData<DataModel>
) => {
	if (!indexConfig) {
		return;
	}

	const tableConfig = indexConfig?.[tableName];
	if (!tableConfig) {
		return;
	}

	return tableConfig.map((config) => {
		const { index: indexName, identifiers, ...rest } = config;

		const index = String(indexName);

		const fields = getTableIndexes(schema, tableName).find(
			(i) => i.indexDescriptor == index
		)?.fields;

		if (!fields) {
			throw new Error(`Error in 'constructIndexData()'. No fields found for index: [${index}]`);
		}

		// Create a unique map in case there is any overlap in identifiers
		const identifierMap = new Map<string, string>(
			[...(identifiers ?? []), '_id']?.map((i) => {
				return [String(i), String(i)];
			})
		);

		return {
			name: index,
			fields,
			identifiers: Array.from(identifierMap.values()),
			...rest,
		};
	});
};
