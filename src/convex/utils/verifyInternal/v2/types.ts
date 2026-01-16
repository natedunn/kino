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

export type UniqueRowConfigOptions = {
	queryExistingWithNullish?: boolean;
};

export type UniqueRowConfigData<DM extends DMGeneric> = {
	[K in keyof DM]?: ({
		index: keyof Indexes<NamedTableInfo<DM, K>>;
		identifiers?: (keyof NamedTableInfo<DM, K>['document'])[];
	} & UniqueRowConfigOptions)[];
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

export type UniqueRowInput = {
	_type: 'uniqueRow';
	verify: (ctx: any, tableName: any, data: any, options?: any) => Promise<any>;
	config: Record<string, any>;
	schema: any;
};

// Add more input types here as you create more config functions
// export type UniqueColumnInput = { ... }
// export type UneditableColumnsInput = { ... }

export type VerifyConfigInput = {
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
export type ExtractDefaultValuesConfig<VC> = VC extends { defaultValues: { config: infer C } }
	? C
	: Record<string, never>;

/**
 * Extract the config type from uniqueRow.config
 */
export type ExtractUniqueRowConfig<VC> = VC extends { uniqueRow: { config: infer C } }
	? C
	: Record<string, never>;

// Add more extractors as needed

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
