export { getTableIndexes, constructColumnData, constructIndexData } from './helpers';

// Re-export types from core for convenience
export { normalizeIndexConfigEntry } from '../core/types';
export type {
	NormalizedIndexConfig,
	IndexConfigBaseOptions,
	IndexConfigEntry,
} from '../core/types';
