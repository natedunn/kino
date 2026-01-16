import {
	DataModelFromSchemaDefinition,
	DocumentByName,
	GenericSchema,
	SchemaDefinition,
	TableNamesInDataModel,
	WithoutSystemFields,
} from 'convex/server';

import { DefaultValuesConfigData, MakeOptional } from './types';

export const defaultValuesConfig = <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
	const C extends DefaultValuesConfigData<DataModel>,
>(
	_schema: S,
	config: C
) => {
	const verify = <TN extends TableNamesInDataModel<DataModel>>(
		tableName: TN,
		data: MakeOptional<WithoutSystemFields<DocumentByName<DataModel, TN>>, keyof C[TN]>
	): WithoutSystemFields<DocumentByName<DataModel, TN>> => {
		return {
			...(config[tableName] as Partial<WithoutSystemFields<DocumentByName<DataModel, TN>>>),
			...(data as WithoutSystemFields<DocumentByName<DataModel, TN>>),
		};
	};

	return {
		_type: 'defaultValues' as const,
		verify,
		config: config as C,
	};
};
