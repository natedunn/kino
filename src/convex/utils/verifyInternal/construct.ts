import {
	DataModelFromSchemaDefinition,
	DocumentByName,
	GenericSchema,
	SchemaDefinition,
	TableNamesInDataModel,
} from 'convex/server';

import { getTableIndexes } from './helpers';
import { ConfigOption } from './types';

/**
 * Generate column data
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
	}: {
		allowNullishValue?: boolean;
	}
) => {
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

	console.log(columnData);

	return columnData;
};

/**
 * Construct index data
 */
export const constructIndexData = <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
	TN extends TableNamesInDataModel<DataModel>,
>(
	schema: S,
	tableName: TN,
	indexConfig?: ConfigOption<DataModel>
) => {
	if (!indexConfig) {
		return;
	}

	return indexConfig?.[tableName]?.map((config) => {
		const { index: indexName, identifiers, ...rest } = config;

		const index = String(config.index);

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
