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
	ProtectedKeysForTable,
	VerifyConfigInput,
} from './types';

/**
 * Extended config input that includes optional validate plugins
 */
type VerifyConfigInputWithPlugins = VerifyConfigInput & {
	/**
	 * Validate plugins to run after transforms.
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
	// Get all validate plugins
	const validatePlugins = configs.plugins ?? [];

	/**
	 * Insert a document with all configured verifications applied.
	 *
	 * Execution order:
	 * 1. Transform: defaultValues (makes fields optional, applies defaults)
	 * 2. Validate: plugins (in order provided)
	 * 3. Insert into database
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
			verifiedData = await configs.defaultValues.verify(tableName, verifiedData);
		}

		// === VALIDATE PHASE ===

		// Run all validate plugins
		if (validatePlugins.length > 0) {
			verifiedData = await runValidatePlugins(
				validatePlugins,
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
	 * Protected columns (if configured) are removed from the input type.
	 * Use dangerouslyPatch() to bypass protected column restrictions.
	 *
	 * Execution order:
	 * 1. Validate: plugins (in order provided)
	 * 2. Patch in database
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
		data: HasKey<VC, 'protectedColumns'> extends true
			? Omit<
					Partial<WithoutSystemFields<D>>,
					ProtectedKeysForTable<VC, TN> & keyof WithoutSystemFields<D>
				>
			: Partial<WithoutSystemFields<D>>,
		options?: {
			onFail?: OnFailCallback<D>;
		}
	): Promise<void> => {
		let verifiedData = data as Partial<WithoutSystemFields<DocumentByName<DataModel, TN>>>;

		// === VALIDATE PHASE ===

		// Run all validate plugins
		if (validatePlugins.length > 0) {
			verifiedData = await runValidatePlugins(
				validatePlugins,
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

	/**
	 * Patch a document bypassing protected column restrictions.
	 *
	 * WARNING: This allows patching ANY column, including protected ones.
	 * Only use this when you explicitly need to update a protected column.
	 *
	 * Validation plugins still run - only type restrictions are bypassed.
	 */
	const dangerouslyPatch = async <
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

		// Run all validate plugins (protection is bypassed, but validation still runs)
		if (validatePlugins.length > 0) {
			verifiedData = await runValidatePlugins(
				validatePlugins,
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
		dangerouslyPatch,
		// Expose configs for debugging/advanced usage
		configs,
	};
};
