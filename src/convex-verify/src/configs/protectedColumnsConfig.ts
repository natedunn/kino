import {
	DataModelFromSchemaDefinition,
	GenericSchema,
	SchemaDefinition,
	WithoutSystemFields,
} from 'convex/server';

import { DMGeneric } from '../core/types';

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
 * @param schema - Your Convex schema definition
 * @param config - Object mapping table names to arrays of protected column names
 * @returns Config object for use with verifyConfig
 *
 * @example
 * ```ts
 * const protectedColumns = protectedColumnsConfig(schema, {
 *   posts: ['authorId', 'createdAt'],
 *   comments: ['postId', 'authorId'],
 * });
 *
 * // In verifyConfig:
 * const { patch, dangerouslyPatch } = verifyConfig(schema, {
 *   protectedColumns,
 * });
 *
 * // patch() won't allow authorId
 * await patch(ctx, 'posts', id, {
 *   authorId: '...',  // TS Error - property doesn't exist
 *   title: 'new',     // OK
 * });
 *
 * // dangerouslyPatch() allows all columns
 * await dangerouslyPatch(ctx, 'posts', id, {
 *   authorId: '...',  // OK - bypasses protection
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
