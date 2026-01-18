// Main verifyConfig function
export { verifyConfig } from './verifyConfig';

// Plugin system
export { createValidatePlugin, isValidatePlugin, runValidatePlugins } from './plugin';
export type { ValidateContext, ValidatePlugin, ValidatePluginRecord } from './plugin';

// All types
export type {
	// Utility types
	Prettify,
	MakeOptional,
	// Base types
	BaseConfigReturn,
	// OnFail types
	OnFailArgs,
	OnFailCallback,
	// Config data types
	DMGeneric,
	DefaultValuesConfigData,
	// Index-based config types
	IndexConfigBaseOptions,
	IndexConfigEntry,
	NormalizedIndexConfig,
	// UniqueRow types
	UniqueRowConfigOptions,
	UniqueRowConfigEntry,
	UniqueRowConfigData,
	// UniqueColumn types
	UniqueColumnConfigOptions,
	UniqueColumnConfigEntry,
	UniqueColumnConfigData,
	// Input types
	DefaultValuesInput,
	ProtectedColumnsInput,
	// VerifyConfig types
	VerifyConfigInput,
	// Type extraction helpers
	ExtractDefaultValuesConfig,
	OptionalKeysForTable,
	HasKey,
	ExtractProtectedColumnsConfig,
	ProtectedKeysForTable,
} from './types';

// Utility function
export { normalizeIndexConfigEntry } from './types';
