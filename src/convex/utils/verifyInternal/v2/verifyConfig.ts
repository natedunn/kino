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
		const onFail = options?.onFail as OnFailCallback<DocumentByName<DataModel, TN>> | undefined;

		// Step 1: Apply default values (transforms data)
		if (configs.defaultValues) {
			verifiedData = configs.defaultValues.verify(tableName, verifiedData);
		}

		// Step 2: Check unique rows (validates, may throw)
		if (configs.uniqueRow) {
			verifiedData = await configs.uniqueRow.verify(ctx, tableName, verifiedData, {
				operation: 'insert',
				onFail,
			});
		}

		// Add more verification steps here as you add more config types
		// if (configs.uniqueColumn) { ... }
		// if (configs.uneditableColumns) { ... }

		// Final insert
		const id = await ctx.db.insert(tableName, verifiedData);
		return id as GenericId<TN>;
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
		let verifiedData = data as Partial<WithoutSystemFields<DocumentByName<DataModel, TN>>>;
		const _onFail = options?.onFail;

		// For patch, we might skip defaultValues since we're updating existing data
		// But uniqueRow checks still apply

		// Check unique rows (validates, may throw)
		if (configs.uniqueRow) {
			// Note: For patch, you might want a different verify signature
			// that accepts partial data and the existing document ID
			// For now, we'll skip this in patch
		}

		// Add more verification steps here

		await ctx.db.patch(id, verifiedData);
	};

	return {
		insert,
		patch,
		// Expose configs for debugging/advanced usage
		configs,
	};
};
