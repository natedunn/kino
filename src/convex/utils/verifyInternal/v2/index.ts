// Config functions
export { defaultValuesConfig } from './defaultValuesConfig';
export { uniqueRowConfig } from './uniqueRowConfig';

// Main verifyConfig
export { verifyConfig } from './verifyConfig';

// Helpers (export for advanced usage)
export { constructColumnData, constructIndexData, getTableIndexes } from './helpers';

// Types (export for advanced usage)
export type {
	DefaultValuesConfigData,
	DefaultValuesInput,
	ExtractDefaultValuesConfig,
	ExtractUniqueRowConfig,
	HasKey,
	MakeOptional,
	OnFailArgs,
	OnFailCallback,
	OptionalKeysForTable,
	Prettify,
	UniqueRowConfigData,
	UniqueRowConfigOptions,
	UniqueRowInput,
	VerifyConfigInput,
} from './types';
