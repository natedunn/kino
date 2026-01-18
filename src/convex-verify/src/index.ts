// =============================================================================
// Core
// =============================================================================

export { verifyConfig } from './core';
export { createValidatePlugin, isValidatePlugin, runValidatePlugins } from './core';
export type { ValidateContext, ValidatePlugin, ValidatePluginRecord } from './core';
export type {
	// Utility types
	Prettify,
	MakeOptional,
	// OnFail types
	OnFailArgs,
	OnFailCallback,
	// VerifyConfig types
	VerifyConfigInput,
	// Type extraction helpers
	ExtractDefaultValuesConfig,
	OptionalKeysForTable,
	HasKey,
	ExtractProtectedColumnsConfig,
	ProtectedKeysForTable,
} from './core';

// =============================================================================
// Transforms
// =============================================================================

export { defaultValuesConfig } from './transforms';
export type { DefaultValuesConfigData } from './transforms';

// =============================================================================
// Configs
// =============================================================================

export { protectedColumnsConfig } from './configs';
export type { ProtectedColumnsConfigData } from './configs';

// =============================================================================
// Plugins
// =============================================================================

export { uniqueRowConfig, uniqueColumnConfig } from './plugins';
export type {
	UniqueRowConfigData,
	UniqueRowConfigEntry,
	UniqueRowConfigOptions,
	UniqueColumnConfigData,
	UniqueColumnConfigEntry,
	UniqueColumnConfigOptions,
} from './plugins';

// =============================================================================
// Utils
// =============================================================================

export { getTableIndexes, constructColumnData, constructIndexData } from './utils';
export { normalizeIndexConfigEntry } from './utils';
export type { NormalizedIndexConfig, IndexConfigBaseOptions, IndexConfigEntry } from './utils';
