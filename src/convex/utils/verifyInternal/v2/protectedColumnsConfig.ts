import {
	DataModelFromSchemaDefinition,
	GenericSchema,
	SchemaDefinition,
	WithoutSystemFields,
} from 'convex/server';

import { DMGeneric } from './types';

/**
 * Config data type for protected columns.
 * Maps table names to arrays of column names that should be protected from patching.
 */
export type ProtectedColumnsConfigData<DM extends DMGeneric> = {
	[K in keyof DM]?: (keyof WithoutSystemFields<DM[K]['document']>)[];
};

/**
 * Creates a protected columns config.
 *
 * Protected columns are removed from the patch() input type,
 * preventing accidental updates to critical fields like foreign keys.
 * Use dangerouslyPatch() to bypass this protection when needed.
 *
 * @example
 * ```ts
 * const protectedColumns = protectedColumnsConfig(schema, {
 *   feedback: ['projectId', 'userId'],
 *   profile: ['userId'],
 * });
 *
 * // In verifyConfig:
 * const { patch, dangerouslyPatch } = verifyConfig(schema, {
 *   protectedColumns,
 * });
 *
 * // patch() won't allow projectId or userId
 * await patch(ctx, 'feedback', id, {
 *   projectId: '...',  // TS Error - property doesn't exist
 *   title: 'new',      // OK
 * });
 *
 * // dangerouslyPatch() allows all columns
 * await dangerouslyPatch(ctx, 'feedback', id, {
 *   projectId: '...',  // OK - bypasses protection
 * });
 * ```
 */
export const protectedColumnsConfig = <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
	const C extends ProtectedColumnsConfigData<DataModel>,
>(
	_schema: S,
	config: C
) => {
	return {
		_type: 'protectedColumns' as const,
		config,
	};
};
