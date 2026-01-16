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

import {
	HasKey,
	MakeOptional,
	OnFailCallback,
	OptionalKeysForTable,
	VerifyConfigInput,
} from './types';

export const verifyConfig = <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
	const VC extends VerifyConfigInput,
>(
	_schema: S,
	configs: VC
) => {
	/**
	 * Insert a document with all configured verifications applied.
	 */
	const insert = async <
		const TN extends TableNamesInDataModel<DataModel>,
		const D extends DocumentByName<DataModel, TN>,
	>(
		ctx: Omit<GenericMutationCtx<DataModel>, never>,
		tableName: TN,
		data: HasKey<VC, 'defaultValues'> extends true
			? MakeOptional<
					WithoutSystemFields<D>,
					OptionalKeysForTable<VC, TN> & keyof WithoutSystemFields<D>
				>
			: WithoutSystemFields<D>,
		options?: {
			onFail?: OnFailCallback<D>;
		}
	): Promise<GenericId<TN>> => {
		let verifiedData = data as WithoutSystemFields<DocumentByName<DataModel, TN>>;

		// Step 1: Apply default values (transforms data)
		if (configs.defaultValues) {
			verifiedData = configs.defaultValues.verify(tableName, verifiedData);
		}

		// Step 2: Check unique rows (validates, may throw)
		if (configs.uniqueRow) {
			verifiedData = await configs.uniqueRow.verify(ctx, tableName, verifiedData, {
				operation: 'insert',
				onFail: options?.onFail,
			});
		}

		// Add more verification steps here as you add more config types
		// if (configs.uniqueColumn) { ... }
		// if (configs.uneditableColumns) { ... }

		// Final insert
		return await ctx.db.insert(tableName, verifiedData);
	};

	/**
	 * Patch a document with all configured verifications applied.
	 */
	const patch = async <
		const TN extends TableNamesInDataModel<DataModel>,
		const D extends DocumentByName<DataModel, TN>,
	>(
		ctx: Omit<GenericMutationCtx<DataModel>, never>,
		tableName: TN,
		id: GenericId<TN>,
		data: Partial<WithoutSystemFields<D>>,
		options?: {
			onFail?: OnFailCallback<D>;
		}
	): Promise<void> => {
		let verifiedData = data;
		// const onFail = options?.onFail as OnFailCallback<DocumentByName<DataModel, TN>> | undefined;

		// For patch, we skip defaultValues since we're updating existing data
		// But uniqueRow checks still apply

		// Check unique rows (validates, may throw)
		if (configs.uniqueRow) {
			verifiedData = await configs.uniqueRow.verify(ctx, tableName, verifiedData, {
				operation: 'patch',
				patchId: id,
				onFail: options?.onFail,
			});
		}

		console.log(verifiedData);

		// Add more verification steps here as you add more config types
		// if (configs.uniqueColumn) { ... }
		// if (configs.uneditableColumns) { ... }

		await ctx.db.patch(id, verifiedData);
	};

	return {
		insert,
		patch,
		// Expose configs for debugging/advanced usage
		configs,
	};
};
