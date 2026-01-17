import {
	DataModelFromSchemaDefinition,
	DocumentByName,
	GenericMutationCtx,
	GenericSchema,
	Indexes,
	NamedTableInfo,
	SchemaDefinition,
	TableNamesInDataModel,
	WithoutSystemFields,
} from 'convex/server';

// =============================================================================
// Utility Types
// =============================================================================

export type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type MakeOptional<T, K extends PropertyKey> = Prettify<
	Omit<T, K & keyof T> & Partial<Pick<T, K & keyof T>>
>;

// =============================================================================
// Base Types for Config Functions
// =============================================================================

/**
 * Base interface that all config functions should return.
 * Each config type can have its own `verify` signature and additional properties.
 */
export type BaseConfigReturn = {
	config: Record<string, any>;
};

// =============================================================================
// OnFail Types
// =============================================================================

export type OnFailArgs<D> = {
	uniqueColumn?: {
		conflictingColumn: keyof D;
		existingData: D;
	};
	uniqueRow?: {
		existingData: D | null;
	};
	editableColumn?: {
		removedColumns: string[];
		filteredData: D;
	};
	requiredColumn?: {
		missingColumn: keyof D;
	};
};

export type OnFailCallback<D> = (args: OnFailArgs<D>) => void;

// =============================================================================
// Config Data Types (what the user provides)
// =============================================================================

export type DMGeneric = DataModelFromSchemaDefinition<SchemaDefinition<any, boolean>>;

export type DefaultValuesConfigData<DM extends DMGeneric> = {
	[K in keyof DM]?: {
		[column in keyof WithoutSystemFields<DM[K]['document']>]?: DM[K]['document'][column];
	};
};

// =============================================================================
// Index-Based Config Types (shared between uniqueRow, uniqueColumn, etc.)
// =============================================================================

/**
 * Base options shared by all index-based config entries.
 * Individual plugins can extend this with their own options.
 */
export type IndexConfigBaseOptions = {
	/** Additional identifiers to check if the existing row is the same document being updated */
	identifiers?: string[];
};

/**
 * A config entry that can be either:
 * - A string (index name) for shorthand
 * - An object with `index` and additional options
 *
 * @example
 * ```ts
 * // These are equivalent:
 * 'by_username'
 * { index: 'by_username' }
 *
 * // With options:
 * { index: 'by_username', identifiers: ['_id', 'userId'] }
 * ```
 */
export type IndexConfigEntry<
	DM extends DMGeneric,
	K extends keyof DM,
	Options extends IndexConfigBaseOptions = IndexConfigBaseOptions,
> =
	| keyof Indexes<NamedTableInfo<DM, K>>
	| ({
			index: keyof Indexes<NamedTableInfo<DM, K>>;
			identifiers?: (keyof NamedTableInfo<DM, K>['document'])[];
	  } & Omit<Options, 'identifiers'>);

/**
 * Normalized form of an index config entry (always an object)
 */
export type NormalizedIndexConfig<Options extends IndexConfigBaseOptions = IndexConfigBaseOptions> =
	{
		index: string;
		identifiers: string[];
	} & Omit<Options, 'identifiers'>;

/**
 * Normalize a config entry to always have index and identifiers.
 * Works for both string shorthand and full object configs.
 */
export function normalizeIndexConfigEntry<
	Options extends IndexConfigBaseOptions = IndexConfigBaseOptions,
>(
	entry: string | ({ index: string; identifiers?: string[] } & Omit<Options, 'identifiers'>),
	defaultIdentifiers: string[] = ['_id']
): NormalizedIndexConfig<Options> {
	if (typeof entry === 'string') {
		return {
			index: entry,
			identifiers: defaultIdentifiers,
		} as NormalizedIndexConfig<Options>;
	}

	const { index, identifiers, ...rest } = entry;
	return {
		index: String(index),
		identifiers: identifiers?.map(String) ?? defaultIdentifiers,
		...rest,
	} as NormalizedIndexConfig<Options>;
}

// =============================================================================
// UniqueRow Config Types
// =============================================================================

export type UniqueRowConfigOptions = IndexConfigBaseOptions & {
	queryExistingWithNullish?: boolean;
};

export type UniqueRowConfigEntry<DM extends DMGeneric, K extends keyof DM> = IndexConfigEntry<
	DM,
	K,
	UniqueRowConfigOptions
>;

export type UniqueRowConfigData<DM extends DMGeneric> = {
	[K in keyof DM]?: UniqueRowConfigEntry<DM, K>[];
};

// =============================================================================
// UniqueColumn Config Types
// =============================================================================

export type UniqueColumnConfigOptions = IndexConfigBaseOptions;

export type UniqueColumnConfigEntry<DM extends DMGeneric, K extends keyof DM> = IndexConfigEntry<
	DM,
	K,
	UniqueColumnConfigOptions
>;

export type UniqueColumnConfigData<DM extends DMGeneric> = {
	[K in keyof DM]?: UniqueColumnConfigEntry<DM, K>[];
};

// =============================================================================
// Input Types (loose types for verifyConfig to accept)
// =============================================================================

/**
 * Loose input types that accept any return from config functions.
 * We use loose types here to avoid complex generic matching,
 * then extract the specific config types using conditional types.
 */
export type DefaultValuesInput = {
	_type: 'defaultValues';
	verify: (tableName: any, data: any) => any;
	config: Record<string, Record<string, any>>;
};

// =============================================================================
// Object-Based Types (for verifyConfig)
// =============================================================================

/**
 * Config input for verifyConfig.
 *
 * - `defaultValues`: Transform plugin that makes fields optional (affects types)
 * - `plugins`: Array of validate plugins (use for uniqueRow, uniqueColumn, custom plugins, etc.)
 */
export type VerifyConfigInput = {
	defaultValues?: DefaultValuesInput;
};

// =============================================================================
// Type Extraction Helpers
// =============================================================================

/**
 * Extract the config type from defaultValues.config
 */
export type ExtractDefaultValuesConfig<VC> = VC extends { defaultValues: { config: infer C } }
	? C
	: Record<string, never>;

/**
 * Compute which keys should be optional for a given table based on all configs.
 * Currently only defaultValues affects optionality.
 */
export type OptionalKeysForTable<VC, TN> = TN extends keyof ExtractDefaultValuesConfig<VC>
	? keyof ExtractDefaultValuesConfig<VC>[TN]
	: never;

/**
 * Helper to check if a key exists in a type
 */
export type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;
