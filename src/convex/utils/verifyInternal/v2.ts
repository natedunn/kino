import {
	DataModelFromSchemaDefinition,
	DocumentByName,
	GenericMutationCtx,
	GenericSchema,
	NamedTableInfo,
	SchemaDefinition,
	TableNamesInDataModel,
	WithoutSystemFields,
} from 'convex/server';
import { GenericId } from 'convex/values';

import { DefaultValuesConfig } from './types';

// =============================================================================
// Utility Types
// =============================================================================

type Prettify<T> = { [K in keyof T]: T[K] } & {};

type MakeOptional<T, K extends PropertyKey> = Prettify<
	Omit<T, K & keyof T> & Partial<Pick<T, K & keyof T>>
>;

export type DMGeneric = DataModelFromSchemaDefinition<SchemaDefinition<any, boolean>>;

// =============================================================================
// Base Types for Config Functions
// =============================================================================

/**
 * Base interface that all config functions should return.
 * Each config type can have its own `verify` signature and additional properties.
 */
type BaseConfigReturn = {
	config: Record<string, any>;
};

// =============================================================================
// Default Values Config
// =============================================================================

export const defaultValuesConfig = <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
	const C extends DefaultValuesConfig<DataModel>,
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

// =============================================================================
// Unique Row Config (Example - you can expand this)
// =============================================================================

type UniqueRowConfigData<DM extends DMGeneric> = {
	[K in keyof DM]?: {
		index: string;
		identifiers?: (keyof NamedTableInfo<DM, K>['document'])[];
		_INTERNAL_queryExistingWithNullish?: boolean;
		// Add other options as needed
	}[];
};

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
		_ctx: Omit<GenericMutationCtx<DataModel>, never>,
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

// =============================================================================
// Verify Config Input Types
// =============================================================================

/**
 * Loose input types that accept any return from config functions.
 * We use loose types here to avoid complex generic matching,
 * then extract the specific config types using conditional types.
 */
type DefaultValuesInput = {
	_type: 'defaultValues';
	verify: (tableName: any, data: any) => any;
	config: Record<string, Record<string, any>>;
};

type UniqueRowInput = {
	_type: 'uniqueRow';
	verify: (ctx: any, tableName: any, data: any) => Promise<any>;
	config: Record<string, any>;
};

// Add more input types here as you create more config functions
// type UniqueColumnInput = { ... }
// type UneditableColumnsInput = { ... }

type VerifyConfigInput = {
	defaultValues?: DefaultValuesInput;
	uniqueRow?: UniqueRowInput;
	// Add more optional configs here
	// uniqueColumn?: UniqueColumnInput;
	// uneditableColumns?: UneditableColumnsInput;
};

// =============================================================================
// Type Extraction Helpers
// =============================================================================

/**
 * Extract the config type from defaultValues.config
 */
type ExtractDefaultValuesConfig<VC> = VC extends { defaultValues: { config: infer C } }
	? C
	: Record<string, never>;

/**
 * Extract the config type from uniqueRow.config
 */
type ExtractUniqueRowConfig<VC> = VC extends { uniqueRow: { config: infer C } }
	? C
	: Record<string, never>;

// Add more extractors as needed

/**
 * Compute which keys should be optional for a given table based on all configs.
 * Currently only defaultValues affects optionality.
 */
type OptionalKeysForTable<VC, TN> = TN extends keyof ExtractDefaultValuesConfig<VC>
	? keyof ExtractDefaultValuesConfig<VC>[TN]
	: never;

/**
 * Helper to check if a key exists in a type
 */
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

// =============================================================================
// Verify Config
// =============================================================================

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
			: WithoutSystemFields<D>
	): Promise<GenericId<TN>> => {
		let verifiedData = data as WithoutSystemFields<DocumentByName<DataModel, TN>>;

		// Step 1: Apply default values (transforms data)
		if (configs.defaultValues) {
			verifiedData = configs.defaultValues.verify(tableName, verifiedData);
		}

		// Step 2: Check unique rows (validates, may throw)
		if (configs.uniqueRow) {
			verifiedData = await configs.uniqueRow.verify(ctx, tableName, verifiedData);
		}

		// Add more verification steps here as you add more config types
		// if (configs.uniqueColumn) { ... }
		// if (configs.uneditableColumns) { ... }

		// Final insert
		const id = await ctx.db.insert(tableName, verifiedData);
		return id;
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
		data: Partial<WithoutSystemFields<D>>
	): Promise<void> => {
		let verifiedData = data as Partial<WithoutSystemFields<DocumentByName<DataModel, TN>>>;

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
