// Config functions
export { defaultValuesConfig } from './defaultValuesConfig';
export { uniqueColumnConfig } from './uniqueColumnConfig';
export { uniqueRowConfig } from './uniqueRowConfig';

// Main verifyConfig
export { verifyConfig } from './verifyConfig';

// Plugin system
export { createValidatePlugin, isValidatePlugin, runValidatePlugins } from './plugin';
export type { ValidateContext, ValidatePlugin, ValidatePluginRecord } from './plugin';

// Helpers (export for advanced usage)
export { constructColumnData, constructIndexData, getTableIndexes } from './helpers';

// Types (export for advanced usage)
export type {
	// Config data types
	DefaultValuesConfigData,
	DefaultValuesInput,
	// Shared index-based config types
	IndexConfigBaseOptions,
	IndexConfigEntry,
	NormalizedIndexConfig,
	// UniqueRow types
	UniqueRowConfigData,
	UniqueRowConfigEntry,
	UniqueRowConfigOptions,
	UniqueRowInput,
	// UniqueColumn types
	UniqueColumnConfigData,
	UniqueColumnConfigEntry,
	UniqueColumnConfigOptions,
	// OnFail types
	OnFailArgs,
	OnFailCallback,
	// Utility types
	MakeOptional,
	Prettify,
	// Object-based config types
	ExtractDefaultValuesConfig,
	ExtractUniqueRowConfig,
	HasKey,
	OptionalKeysForTable,
	VerifyConfigInput,
} from './types';

// Re-export normalize helper for plugin authors
export { normalizeIndexConfigEntry } from './types';
