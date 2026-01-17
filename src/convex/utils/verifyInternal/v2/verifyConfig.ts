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

import { runValidatePlugins, ValidatePlugin } from './plugin';
import {
	HasKey,
	MakeOptional,
	OnFailCallback,
	OptionalKeysForTable,
	VerifyConfigInput,
} from './types';

/**
 * Extended config input that includes optional validate plugins
 */
type VerifyConfigInputWithPlugins = VerifyConfigInput & {
	/**
	 * Additional validate plugins to run after built-in validators.
	 * These plugins can validate data but don't affect input types.
	 */
	plugins?: ValidatePlugin[];
};

export const verifyConfig = <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
	const VC extends VerifyConfigInputWithPlugins,
>(
	_schema: S,
	configs: VC
) => {
	// Build the list of all validate plugins
	// uniqueRow is now a ValidatePlugin, so we can treat it the same as custom plugins
	const allValidatePlugins: ValidatePlugin[] = [
		// Built-in plugins first (if provided)
		...(configs.uniqueRow ? [configs.uniqueRow as ValidatePlugin] : []),
		// Then custom plugins
		...(configs.plugins ?? []),
	];

	/**
	 * Insert a document with all configured verifications applied.
	 *
	 * Execution order:
	 * 1. Transform: defaultValues (makes fields optional, applies defaults)
	 * 2. Validate: uniqueRow (built-in plugin)
	 * 3. Validate: custom plugins (in order provided)
	 * 4. Insert into database
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

		// === TRANSFORM PHASE ===

		// Apply default values (transforms data)
		if (configs.defaultValues) {
			verifiedData = configs.defaultValues.verify(tableName, verifiedData);
		}

		// === VALIDATE PHASE ===

		// Run all validate plugins (built-in + custom)
		if (allValidatePlugins.length > 0) {
			verifiedData = await runValidatePlugins(
				allValidatePlugins,
				{
					ctx,
					tableName: tableName as string,
					operation: 'insert',
					onFail: options?.onFail,
					schema: _schema,
				},
				verifiedData
			);
		}

		// Final insert
		return await ctx.db.insert(tableName, verifiedData);
	};

	/**
	 * Patch a document with all configured verifications applied.
	 *
	 * Execution order:
	 * 1. Validate: uniqueRow (built-in plugin)
	 * 2. Validate: custom plugins (in order provided)
	 * 3. Patch in database
	 *
	 * Note: defaultValues is skipped for patch operations
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

		// === VALIDATE PHASE ===

		// Run all validate plugins (built-in + custom)
		if (allValidatePlugins.length > 0) {
			verifiedData = await runValidatePlugins(
				allValidatePlugins,
				{
					ctx,
					tableName: tableName as string,
					operation: 'patch',
					patchId: id,
					onFail: options?.onFail,
					schema: _schema,
				},
				verifiedData
			);
		}

		await ctx.db.patch(id, verifiedData);
	};

	return {
		insert,
		patch,
		// Expose configs for debugging/advanced usage
		configs,
	};
};
