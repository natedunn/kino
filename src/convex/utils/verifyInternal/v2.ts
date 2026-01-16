import {
	DataModelFromSchemaDefinition,
	DocumentByName,
	GenericMutationCtx,
	GenericSchema,
	SchemaDefinition,
	TableNamesInDataModel,
	WithoutSystemFields,
} from 'convex/server';
import { GenericId } from 'convex/values';

import { DefaultValuesConfig } from './types';

type Prettify<T> = { [K in keyof T]: T[K] } & {};
type MakeOptional<T, K extends PropertyKey> = Prettify<
	Omit<T, K & keyof T> & Partial<Pick<T, K & keyof T>>
>;

export const defaultValuesConfig = <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
	const C extends DefaultValuesConfig<DataModel>,
>(
	schema: S,
	config: C
) => {
	/**
	 * Verify
	 */
	const verify = <
		S extends SchemaDefinition<GenericSchema, boolean>,
		DataModel extends DataModelFromSchemaDefinition<S>,
		const TN extends TableNamesInDataModel<DataModel>,
	>(
		tableName: TN,
		data: MakeOptional<
			WithoutSystemFields<DocumentByName<DataModel, TN>>, //
			keyof C[TN]
		>
	): WithoutSystemFields<DocumentByName<DataModel, TN>> => {
		return {
			...(config[tableName] as Partial<WithoutSystemFields<DocumentByName<DataModel, TN>>>),
			...(data as WithoutSystemFields<DocumentByName<DataModel, TN>>),
		};
	};

	return {
		verify,
		config: config as C,
	};
};

type VerifyConfig = {
	defaultValues?: ReturnType<typeof defaultValuesConfig>;
};

type IfKeyExists<T, K extends PropertyKey, Then, Else> = K extends keyof T ? Then : Else;

export const verifyConfig = <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
	const VC extends VerifyConfig,
	const DVC extends NonNullable<VC['defaultValues']>,
>(
	schema: S,
	verify: VC
) => {
	const insert = async <
		const TN extends TableNamesInDataModel<DataModel>,
		const D extends DocumentByName<DataModel, TN>,
	>(
		ctx: Omit<GenericMutationCtx<DataModel>, never>,
		tableName: TN,
		data: IfKeyExists<
			VC,
			'defaultValues',
			MakeOptional<WithoutSystemFields<D>, keyof DVC['config'][TN]>,
			WithoutSystemFields<D>
		>
	) => {
		let verifiedData: WithoutSystemFields<DocumentByName<DataModel, TN>>;

		if (verify?.defaultValues) {
			const test = verify.defaultValues.verify(tableName, data);
			// verifiedData = test;
		}

		return 'something' as GenericId<TN>;
	};
	const patch = () => {};

	return {
		insert,
		patch,
	};
};
